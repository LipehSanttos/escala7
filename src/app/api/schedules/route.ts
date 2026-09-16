import { NextResponse } from "next/server";
import { getSupabase, getServiceRoleClient } from "@/lib/supabase";
import db from "@/lib/db";
import { getCurrentMonthYear, sanitizeScheduleTitle } from "@/lib/dateUtils";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const department_id = searchParams.get("department_id");
    const month_year = searchParams.get("month_year");
    const status = searchParams.get("status");

    const supabase = getSupabase();
    if (supabase) {
      let q = supabase
        .from("schedules")
        .select("*, departments(name, color, icon), schedule_items(id, member_id)");

      if (department_id) q = q.eq("department_id", department_id);
      if (month_year) q = q.eq("month_year", month_year);
      if (status) q = q.eq("status", status);

      const { data, error } = await q.order("month_year", { ascending: false }).order("created_at", { ascending: false });
      if (error) throw error;

      const schedules = (data || []).map((s: any) => {
        const items = s.schedule_items || [];
        const total_items = items.length;
        const distinctMembers = new Set(items.map((i: any) => i.member_id).filter(Boolean));
        const vacant_items_count = items.filter((i: any) => !i.member_id).length;

        return {
          ...s,
          title: sanitizeScheduleTitle(s.title, s.month_year),
          department_name: s.departments?.name || "",
          department_color: s.departments?.color || "#002F6C",
          department_icon: s.departments?.icon || "Calendar",
          total_items,
          total_members_scheduled: distinctMembers.size,
          vacant_items_count,
          schedule_items: undefined
        };
      });

      return NextResponse.json({ success: true, data: schedules });
    }

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

async function checkLeaderAuth(
  authData: { user_id?: string; user_phone?: string; pin?: string },
  departmentId?: string
): Promise<{ authorized: boolean; reason?: string }> {
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

  const supabase = getServiceRoleClient() || getSupabase();
  if (supabase) {
    let memberQuery = supabase.from("members").select("id, name, is_leader").limit(1);
    if (user_id) memberQuery = memberQuery.eq("id", user_id);
    else if (cleanPhone) memberQuery = memberQuery.eq("phone", cleanPhone);
    const { data: mData } = await memberQuery;
    if (!mData || mData.length === 0) {
      return { authorized: false, reason: "Membro não cadastrado no sistema." };
    }
    const member = mData[0];

    if (departmentId) {
      const { data: deptRows } = await supabase
        .from("member_departments")
        .select("is_department_leader")
        .eq("member_id", member.id)
        .eq("department_id", departmentId)
        .eq("is_department_leader", true);

      if (deptRows && deptRows.length > 0) return { authorized: true };
      return {
        authorized: false,
        reason: `Acesso restrito: Cada responsável só pode gerenciar o departamento designado a ele.`
      };
    }

    if (member.is_leader) return { authorized: true };
    return { authorized: false, reason: "Acesso restrito: Apenas líderes e responsáveis autorizados podem elaborar escalas." };
  }

  const member = db.prepare(`
    SELECT m.*
    FROM members m
    WHERE (m.id = ? AND ? != '') OR (m.phone = ? AND ? != '')
  `).get(user_id || "", user_id || "", cleanPhone, cleanPhone) as any;

  if (!member) {
    return { authorized: false, reason: "Membro não cadastrado no sistema." };
  }

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

    const auth = await checkLeaderAuth({ user_id, user_phone, pin }, department_id);
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

    const validItems = Array.isArray(items)
      ? items.filter((it: any) => it.date && it.role_id && it.member_id)
      : [];

    // 1. Validação de Duplicidade Interna: O mesmo membro NÃO pode estar duas vezes na mesma data
    const internalDatesMap = new Map<string, Set<string>>();
    for (const it of validItems) {
      if (!internalDatesMap.has(it.date)) internalDatesMap.set(it.date, new Set());
      if (internalDatesMap.get(it.date)!.has(it.member_id)) {
        return NextResponse.json({
          success: false,
          error: `Não deve ser possível criar duplicidade na escala. O mesmo membro foi alocado mais de uma vez na data ${it.date}.`
        }, { status: 400 });
      }
      internalDatesMap.get(it.date)!.add(it.member_id);
    }

    const scheduleId = "sch_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

    const supabase = getServiceRoleClient() || getSupabase();
    if (supabase) {
      // 2. Validação de Conflito Geral Cruzado: O membro não pode estar escalado em outro departamento no mesmo dia
      if (validItems.length > 0) {
        const memberIds = [...new Set(validItems.map((it: any) => it.member_id))];
        const dates = [...new Set(validItems.map((it: any) => it.date))];

        const { data: existingAllocations, error: confErr } = await supabase
          .from("schedule_items")
          .select("id, date, member_id, schedules(id, title, departments(name)), roles(name), members(name)")
          .in("member_id", memberIds)
          .in("date", dates);

        if (!confErr && existingAllocations && existingAllocations.length > 0) {
          for (const it of validItems) {
            const conflict = existingAllocations.find((ex: any) => ex.date === it.date && ex.member_id === it.member_id);
            if (conflict) {
              const mName = (conflict as any).members?.name || "Este membro";
              const dName = (conflict as any).schedules?.departments?.name || "outro departamento";
              return NextResponse.json({
                success: false,
                error: `Conflito de escala: O membro "${mName}" já está escalado(a) no departamento "${dName}" no dia ${it.date}. Não é permitida duplicidade de membro no mesmo dia.`
              }, { status: 400 });
            }
          }
        }
      }

      const { error: sErr } = await supabase.from("schedules").insert({
        id: scheduleId,
        department_id,
        title,
        month_year,
        author_name,
        status: status || "published",
        notes: notes || ""
      });
      if (sErr) throw sErr;

      if (Array.isArray(items) && items.length > 0) {
        const scheduleItemsToInsert = items
          .filter(it => it.date && it.role_id && it.member_id)
          .map(it => ({
            id: "item_" + Math.random().toString(36).slice(2, 9),
            schedule_id: scheduleId,
            date: it.date,
            service_type: it.service_type || "Culto de Sábado",
            role_id: it.role_id,
            member_id: it.member_id,
            notes: it.notes || ""
          }));

        if (scheduleItemsToInsert.length > 0) {
          const { error: itemsErr } = await supabase.from("schedule_items").insert(scheduleItemsToInsert);
          if (itemsErr) throw itemsErr;
        }
      }

      return NextResponse.json({
        success: true,
        data: { id: scheduleId, message: "Escala criada com sucesso!" }
      });
    }

    // 2. Validação de Conflito Geral Cruzado no SQLite
    for (const it of validItems) {
      const conflict = db.prepare(`
        SELECT si.*, d.name as department_name, m.name as member_name
        FROM schedule_items si
        JOIN schedules s ON si.schedule_id = s.id
        JOIN departments d ON s.department_id = d.id
        JOIN members m ON si.member_id = m.id
        WHERE si.member_id = ? AND si.date = ?
        LIMIT 1
      `).get(it.member_id, it.date) as any;

      if (conflict) {
        return NextResponse.json({
          success: false,
          error: `Conflito de escala: O membro "${conflict.member_name}" já está escalado(a) no departamento "${conflict.department_name}" no dia ${it.date}. Não é permitida duplicidade de membro no mesmo dia.`
        }, { status: 400 });
      }
    }

    // Iniciar transação no SQLite
    const insertSchedule = db.prepare(`
      INSERT INTO schedules (id, department_id, title, month_year, author_name, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insertItem = db.prepare(`
      INSERT INTO schedule_items (id, schedule_id, date, service_type, role_id, member_id, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

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
