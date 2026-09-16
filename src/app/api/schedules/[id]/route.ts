import { NextResponse } from "next/server";
import db from "@/lib/db";
import { sanitizeScheduleTitle } from "@/lib/dateUtils";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const schedule = db.prepare(`
      SELECT 
        s.*,
        d.name as department_name,
        d.color as department_color,
        d.icon as department_icon
      FROM schedules s
      JOIN departments d ON s.department_id = d.id
      WHERE s.id = ?
    `).get(id) as any;

    if (!schedule) {
      return NextResponse.json({ success: false, error: "Escala não encontrada" }, { status: 404 });
    }

    const items = db.prepare(`
      SELECT 
        si.*,
        r.name as role_name,
        m.name as member_name,
        m.phone as member_phone,
        m.is_active as member_active
      FROM schedule_items si
      JOIN roles r ON si.role_id = r.id
      LEFT JOIN members m ON si.member_id = m.id
      WHERE si.schedule_id = ?
      ORDER BY si.date ASC, si.service_type ASC, r.name ASC
    `).all(id);

    return NextResponse.json({
      success: true,
      data: {
        ...schedule,
        title: sanitizeScheduleTitle(schedule.title, schedule.month_year),
        items
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

function checkLeaderAuth(
  authData: { user_id?: string; user_phone?: string; pin?: string },
  schedule: { author_name?: string; department_id?: string }
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
    return { authorized: false, reason: "Usuário deslogado." };
  }
  const member = db.prepare(`
    SELECT m.*
    FROM members m
    WHERE (m.id = ? AND ? != '') OR (m.phone = ? AND ? != '')
  `).get(user_id || "", user_id || "", cleanPhone, cleanPhone) as any;

  if (!member) {
    return { authorized: false, reason: "Membro não encontrado." };
  }

  if (schedule.author_name && member.name.trim().toLowerCase() === schedule.author_name.trim().toLowerCase()) {
    return { authorized: true };
  }

  if (schedule.department_id) {
    const isDeptLeader = db.prepare(`
      SELECT COUNT(*) as count 
      FROM member_departments 
      WHERE member_id = ? AND department_id = ? AND is_department_leader = 1
    `).get(member.id, schedule.department_id) as { count: number };

    if (isDeptLeader && isDeptLeader.count > 0) {
      return { authorized: true };
    }

    const dept = db.prepare("SELECT name FROM departments WHERE id = ?").get(schedule.department_id) as any;
    const deptName = dept?.name || "deste departamento";
    return {
      authorized: false,
      reason: `Acesso restrito: Você não é líder do departamento "${deptName}". Somente o responsável indicado pode alterar escalas dele.`
    };
  }

  return { authorized: false, reason: "Acesso restrito: Apenas o líder responsável pode alterar esta escala." };
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { title, month_year, author_name, notes, status, items, user_id, user_phone, pin } = body;

    const existing = db.prepare("SELECT * FROM schedules WHERE id = ?").get(id) as any;
    if (!existing) {
      return NextResponse.json({ success: false, error: "Escala não encontrada" }, { status: 404 });
    }

    // Apenas líder / responsável autenticado do departamento pode alterar a escala
    const auth = checkLeaderAuth({ user_id, user_phone, pin }, existing);
    if (!auth.authorized) {
      return NextResponse.json({
        success: false,
        error: auth.reason || "Acesso restrito: Apenas o líder responsável pelo departamento pode alterar esta escala."
      }, { status: 403 });
    }

    // Validação de conflitos internos
    if (Array.isArray(items) && items.length > 0) {
      const dayMemberMap = new Map<string, string>();
      for (const item of items) {
        if (!item.member_id || !item.date) continue;
        const key = `${item.date}_${item.member_id}`;
        if (dayMemberMap.has(key)) {
          const member = db.prepare("SELECT name FROM members WHERE id = ?").get(item.member_id) as any;
          return NextResponse.json({
            success: false,
            error: `Conflito detectado: O membro "${member?.name || item.member_id}" está alocado mais de uma vez no dia ${item.date}.`
          }, { status: 400 });
        }
        dayMemberMap.set(key, item.role_id);
      }

      // Conflito externo
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
          WHERE si.member_id = ? AND si.date = ? AND si.schedule_id != ?
          LIMIT 1
        `).get(item.member_id, item.date, id) as any;

        if (conflict) {
          return NextResponse.json({
            success: false,
            error: `Conflito: O membro "${conflict.member_name}" já está escalado no dia ${conflict.date} em "${conflict.department_name}" para "${conflict.role_name}".`
          }, { status: 400 });
        }
      }
    }

    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE schedules
        SET title = ?, month_year = ?, author_name = ?, notes = ?, status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(title, month_year, author_name, notes || "", status || "published", id);

      db.prepare("DELETE FROM schedule_items WHERE schedule_id = ?").run(id);

      if (Array.isArray(items)) {
        const insertItem = db.prepare(`
          INSERT INTO schedule_items (id, schedule_id, date, service_type, role_id, member_id, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        for (const item of items) {
          if (!item.date || !item.role_id) continue;
          const itemId = item.id || ("item_" + Math.random().toString(36).slice(2, 9));
          insertItem.run(
            itemId,
            id,
            item.date,
            item.service_type || "Culto de Sábado",
            item.role_id,
            item.member_id || null,
            item.notes || ""
          );
        }
      }
    });

    tx();

    return NextResponse.json({ success: true, message: "Escala atualizada com sucesso!" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: scheduleId } = await context.params;
    const body = await request.json();
    const { schedule_item_id, new_member_id, notes, user_id, user_phone, pin } = body;

    const existing = db.prepare("SELECT * FROM schedules WHERE id = ?").get(scheduleId) as any;
    if (!existing) {
      return NextResponse.json({ success: false, error: "Escala não encontrada" }, { status: 404 });
    }

    const auth = checkLeaderAuth({ user_id, user_phone, pin }, existing);
    if (!auth.authorized) {
      return NextResponse.json({
        success: false,
        error: auth.reason || "Acesso restrito: Somente o líder responsável pelo departamento pode substituir voluntários nesta escala."
      }, { status: 403 });
    }

    if (!schedule_item_id || !new_member_id) {
      return NextResponse.json({ success: false, error: "Dados incompletos para substituição." }, { status: 400 });
    }

    const newMember = db.prepare("SELECT name FROM members WHERE id = ?").get(new_member_id) as any;
    if (!newMember) {
      return NextResponse.json({ success: false, error: "Membro não encontrado." }, { status: 404 });
    }

    db.prepare(`
      UPDATE schedule_items
      SET member_id = ?, notes = ?
      WHERE id = ? AND schedule_id = ?
    `).run(new_member_id, notes || `Substituto definido pelo responsável: ${newMember.name}`, schedule_item_id, scheduleId);

    return NextResponse.json({
      success: true,
      message: `Voluntário alterado para ${newMember.name} com sucesso!`
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get("phone") || "";
    const pin = searchParams.get("pin") || "";

    const schedule = db.prepare("SELECT * FROM schedules WHERE id = ?").get(id) as any;
    if (!schedule) {
      return NextResponse.json({ success: false, error: "Escala não encontrada" }, { status: 404 });
    }

    // Validação de autorização: Apenas o autor da escala, líder ou PIN administrativo
    let isAuthorized = false;
    const configuredAdminPin = process.env.ADMIN_PIN?.trim();
    if (configuredAdminPin && pin && pin.trim() === configuredAdminPin) {
      isAuthorized = true;
    } else if (phone) {
      const cleanPhone = phone.replace(/\D/g, "");
      const member = db.prepare(`
        SELECT m.*,
          (SELECT COUNT(*) FROM member_departments md WHERE md.member_id = m.id AND md.is_department_leader = 1) as is_dept_leader
        FROM members m
        WHERE m.phone = ?
      `).get(cleanPhone) as any;

      if (member && (member.is_leader === 1 || member.is_dept_leader > 0 || member.name.trim().toLowerCase() === (schedule.author_name || "").trim().toLowerCase())) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({
        success: false,
        error: `Acesso restrito: Apenas o responsável pela elaboração desta escala (${schedule.author_name || "Líder"}) ou um administrador pode excluí-la.`
      }, { status: 403 });
    }

    db.prepare("DELETE FROM schedules WHERE id = ?").run(id);
    return NextResponse.json({ success: true, message: "Escala excluída com sucesso" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}