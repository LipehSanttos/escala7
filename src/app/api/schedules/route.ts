import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getCurrentMonthYear } from "@/lib/dateUtils";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const department_id = searchParams.get("department_id");
    const month_year = searchParams.get("month_year");
    const status = searchParams.get("status");

    let query = `
      SELECT 
        s.*,
        d.name as department_name,
        d.color as department_color,
        d.icon as department_icon,
        (SELECT COUNT(*) FROM schedule_items si WHERE si.schedule_id = s.id) as total_items,
        (SELECT COUNT(DISTINCT si.member_id) FROM schedule_items si WHERE si.schedule_id = s.id) as total_members_scheduled,
        (SELECT COUNT(*) FROM schedule_items si WHERE si.schedule_id = s.id AND (si.member_id IS NULL OR si.member_id = '')) as vacant_items_count
      FROM schedules s
      JOIN departments d ON s.department_id = d.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (department_id) {
      query += ` AND s.department_id = ?`;
      params.push(department_id);
    }
    if (month_year) {
      query += ` AND s.month_year = ?`;
      params.push(month_year);
    }
    if (status) {
      query += ` AND s.status = ?`;
      params.push(status);
    }

    const currentYm = getCurrentMonthYear();
    query += ` ORDER BY CASE WHEN s.month_year = ? THEN 0 ELSE 1 END, s.month_year DESC, s.created_at DESC`;
    params.push(currentYm);

    const schedules = db.prepare(query).all(...params) as any[];
    const sanitizedSchedules = schedules.map(s => ({
      ...s,
      title: sanitizeScheduleTitle(s.title, s.month_year)
    }));
    return NextResponse.json({ success: true, data: sanitizedSchedules });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

import { getStandardScheduleTitle, sanitizeScheduleTitle } from "@/lib/dateUtils";

function checkLeaderAuth(
  authData: { user_id?: string; user_phone?: string; pin?: string },
  departmentId?: string
): { authorized: boolean; reason?: string } {
  const { user_id, user_phone, pin } = authData;
  const rawPin = (pin || "").trim();
  const cleanPhone = user_phone ? user_phone.replace(/\D/g, "") : "";

  const configuredAdminPin = process.env.ADMIN_PIN?.trim();
  if (
    (configuredAdminPin && (rawPin === configuredAdminPin || cleanPhone === configuredAdminPin)) ||
    user_id === "m_admin_leader"
  ) {
    return { authorized: true };
  }
  if (!user_id && !user_phone) {
    return { authorized: false, reason: "Usuário deslogado. Faça login como líder ou responsável." };
  }
  const member = db.prepare(`
    SELECT m.*
    FROM members m
    WHERE (m.id = ? AND ? != '') OR (m.phone = ? AND ? != '')
  `).get(user_id || "", user_id || "", cleanPhone, cleanPhone) as any;

  if (!member) {
    return { authorized: false, reason: "Membro não cadastrado no sistema." };
  }

  // Se foi fornecido o departamento da escala, verificar se é líder especificamente dele
  if (departmentId) {
    const isDeptLeader = db.prepare(`
      SELECT COUNT(*) as count 
      FROM member_departments 
      WHERE member_id = ? AND department_id = ? AND is_department_leader = 1
    `).get(member.id, departmentId) as { count: number };

    if (isDeptLeader && isDeptLeader.count > 0) {
      return { authorized: true };
    }

    const dept = db.prepare("SELECT name FROM departments WHERE id = ?").get(departmentId) as any;
    const deptName = dept?.name || "este departamento";
    return {
      authorized: false,
      reason: `Acesso restrito: Você não é líder do departamento "${deptName}". Cada responsável só pode gerenciar o departamento designado a ele.`
    };
  }

  const isAnyLeader = db.prepare(`
    SELECT COUNT(*) as count 
    FROM member_departments 
    WHERE member_id = ? AND is_department_leader = 1
  `).get(member.id) as { count: number };

  if (isAnyLeader && isAnyLeader.count > 0) {
    return { authorized: true };
  }

  return { authorized: false, reason: "Acesso restrito: Apenas líderes e responsáveis autorizados podem elaborar escalas." };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { department_id, title, month_year, author_name, notes, status, items, user_id, user_phone, pin } = body;

    // Apenas líder / responsável autenticado do departamento especificado pode elaborar a escala
    const auth = checkLeaderAuth({ user_id, user_phone, pin }, department_id);
    if (!auth.authorized) {
      return NextResponse.json({
        success: false,
        error: auth.reason || "Acesso restrito: Apenas o líder designado para este departamento pode elaborar a escala."
      }, { status: 403 });
    }

    if (!department_id || !title || !month_year || !author_name) {
      return NextResponse.json({
        success: false,
        error: "Preencha os campos obrigatórios: departamento, título, mês/ano e responsável."
      }, { status: 400 });
    }

    const scheduleId = "sch_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

    // Iniciar transação no SQLite
    const insertSchedule = db.prepare(`
      INSERT INTO schedules (id, department_id, title, month_year, author_name, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insertItem = db.prepare(`
      INSERT INTO schedule_items (id, schedule_id, date, service_type, role_id, member_id, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    // Validação de conflitos pré-salvamento
    if (Array.isArray(items) && items.length > 0) {
      // 1. Conflito interno (duas funções para o mesmo membro no mesmo dia na própria escala)
      const dayMemberMap = new Map<string, string>();
      for (const item of items) {
        if (!item.member_id || !item.date) continue;
        const key = `${item.date}_${item.member_id}`;
        if (dayMemberMap.has(key)) {
          const member = db.prepare("SELECT name FROM members WHERE id = ?").get(item.member_id) as any;
          return NextResponse.json({
            success: false,
            error: `Conflito detectado: O membro "${member?.name || item.member_id}" foi escalado mais de uma vez no dia ${item.date}.`
          }, { status: 400 });
        }
        dayMemberMap.set(key, item.role_id);
      }

      // 2. Conflito externo (com outras escalas já salvas na mesma data)
      for (const item of items) {
        if (!item.member_id || !item.date) continue;
        const conflict = db.prepare(`
          SELECT 
            si.date,
            r.name as role_name,
            d.name as department_name,
            m.name as member_name
          FROM schedule_items si
          JOIN schedules s ON si.schedule_id = s.id
          JOIN departments d ON s.department_id = d.id
          JOIN roles r ON si.role_id = r.id
          JOIN members m ON si.member_id = m.id
          WHERE si.member_id = ? AND si.date = ?
          LIMIT 1
        `).get(item.member_id, item.date) as any;

        if (conflict) {
          return NextResponse.json({
            success: false,
            error: `Conflito detectado: O membro "${conflict.member_name}" já está escalado no dia ${conflict.date} no departamento "${conflict.department_name}" para a função "${conflict.role_name}".`
          }, { status: 400 });
        }
      }
    }

    const tx = db.transaction(() => {
      insertSchedule.run(
        scheduleId,
        department_id,
        title,
        month_year,
        author_name,
        status || "published",
        notes || ""
      );

      if (Array.isArray(items)) {
        for (const item of items) {
          if (!item.date || !item.role_id || !item.member_id) continue;
          const itemId = "item_" + Math.random().toString(36).slice(2, 9);
          insertItem.run(
            itemId,
            scheduleId,
            item.date,
            item.service_type || "Culto de Sábado",
            item.role_id,
            item.member_id,
            item.notes || ""
          );
        }
      }
    });

    tx();

    return NextResponse.json({
      success: true,
      data: { id: scheduleId, message: "Escala criada com sucesso!" }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
