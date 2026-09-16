import { NextResponse } from "next/server";
import { getSupabase, getServiceRoleClient } from "@/lib/supabase";
import db from "@/lib/db";
import { sanitizeScheduleTitle } from "@/lib/dateUtils";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const supabase = getSupabase();
    if (supabase) {
      const { data: schedule, error: sErr } = await supabase
        .from("schedules")
        .select("*, departments(name, color, icon)")
        .eq("id", id)
        .limit(1)
        .maybeSingle();

      if (sErr || !schedule) {
        return NextResponse.json({ success: false, error: "Escala não encontrada" }, { status: 404 });
      }

      const { data: itemsData, error: iErr } = await supabase
        .from("schedule_items")
        .select("*, roles(name), members(name, phone, is_active)")
        .eq("schedule_id", id)
        .order("date", { ascending: true });

      if (iErr) throw iErr;

      const formattedItems = (itemsData || []).map((it: any) => ({
        id: it.id,
        schedule_id: it.schedule_id,
        date: it.date,
        service_type: it.service_type,
        role_id: it.role_id,
        member_id: it.member_id,
        notes: it.notes || "",
        role_name: it.roles?.name || "",
        member_name: it.members?.name || "",
        member_phone: it.members?.phone || "",
        member_active: it.members?.is_active ?? true
      }));

      return NextResponse.json({
        success: true,
        data: {
          ...schedule,
          department_name: schedule.departments?.name || "",
          department_color: schedule.departments?.color || "#002F6C",
          department_icon: schedule.departments?.icon || "Calendar",
          title: sanitizeScheduleTitle(schedule.title, schedule.month_year),
          items: formattedItems
        }
      });
    }

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

async function checkLeaderAuth(
  authData: { user_id?: string; user_phone?: string; pin?: string },
  schedule: { author_name?: string; department_id?: string }
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
    return { authorized: false, reason: "Usuário deslogado." };
  }

  const supabase = getServiceRoleClient() || getSupabase();
  if (supabase) {
    let memberQuery = supabase.from("members").select("id, name, is_leader").limit(1);
    if (user_id) memberQuery = memberQuery.eq("id", user_id);
    else if (cleanPhone) memberQuery = memberQuery.eq("phone", cleanPhone);
    const { data: mData } = await memberQuery;
    if (!mData || mData.length === 0) return { authorized: false, reason: "Membro não encontrado." };
    const member = mData[0];

    if (schedule.author_name && member.name.trim().toLowerCase() === schedule.author_name.trim().toLowerCase()) {
      return { authorized: true };
    }

    if (schedule.department_id) {
      const { data: deptRows } = await supabase
        .from("member_departments")
        .select("is_department_leader")
        .eq("member_id", member.id)
        .eq("department_id", schedule.department_id)
        .eq("is_department_leader", true);

      if (deptRows && deptRows.length > 0) return { authorized: true };
      return {
        authorized: false,
        reason: `Acesso restrito: Somente o responsável indicado pode alterar escalas dele.`
      };
    }
    return { authorized: false, reason: "Acesso restrito: Apenas o líder responsável pode alterar esta escala." };
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

    const supabase = getServiceRoleClient() || getSupabase();
    if (supabase) {
      const { data: existing } = await supabase.from("schedules").select("*").eq("id", id).maybeSingle();
      if (!existing) {
        return NextResponse.json({ success: false, error: "Escala não encontrada" }, { status: 404 });
      }

      const auth = await checkLeaderAuth({ user_id, user_phone, pin }, existing);
      if (!auth.authorized) {
        return NextResponse.json({
          success: false,
          error: auth.reason || "Acesso restrito: Apenas o líder responsável pelo departamento pode alterar esta escala."
        }, { status: 403 });
      }

      const updatePayload: any = { updated_at: new Date().toISOString() };
      if (title !== undefined) updatePayload.title = title;
      if (month_year !== undefined) updatePayload.month_year = month_year;
      if (author_name !== undefined) updatePayload.author_name = author_name;
      if (notes !== undefined) updatePayload.notes = notes;
      if (status !== undefined) updatePayload.status = status;

      await supabase.from("schedules").update(updatePayload).eq("id", id);

    if (Array.isArray(items)) {
      const validItems = items.filter((it: any) => it.date && it.role_id && it.member_id);

      // 1. Validação de Duplicidade Interna no mesmo dia
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

      // 2. Validação de Conflito Geral Cruzado com outros departamentos
      if (validItems.length > 0) {
        const memberIds = [...new Set(validItems.map((it: any) => it.member_id))];
        const dates = [...new Set(validItems.map((it: any) => it.date))];

        const { data: existingAllocations, error: confErr } = await supabase
          .from("schedule_items")
          .select("id, date, member_id, schedules(id, title, departments(name)), roles(name), members(name)")
          .neq("schedule_id", id)
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

      await supabase.from("schedule_items").delete().eq("schedule_id", id);
      const newItems = validItems.map((it: any) => ({
        id: it.id || ("item_" + Math.random().toString(36).slice(2, 9)),
        schedule_id: id,
        date: it.date,
        service_type: it.service_type || "Culto de Sábado",
        role_id: it.role_id,
        member_id: it.member_id,
        notes: it.notes || ""
      }));

      if (newItems.length > 0) {
        await supabase.from("schedule_items").insert(newItems);
      }
    }

    return NextResponse.json({ success: true, message: "Escala atualizada com sucesso!" });
  }

  const existing = db.prepare("SELECT * FROM schedules WHERE id = ?").get(id) as any;
  if (!existing) {
    return NextResponse.json({ success: false, error: "Escala não encontrada" }, { status: 404 });
  }

  const auth = await checkLeaderAuth({ user_id, user_phone, pin }, existing);
  if (!auth.authorized) {
    return NextResponse.json({
      success: false,
      error: auth.reason || "Acesso restrito: Apenas o líder responsável pelo departamento pode alterar esta escala."
    }, { status: 403 });
  }

  if (Array.isArray(items)) {
    const validItems = items.filter((it: any) => it.date && it.role_id && it.member_id);

    // 1. Validação de Duplicidade Interna no SQLite
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

    // 2. Validação de Conflito Geral Cruzado no SQLite
    for (const it of validItems) {
      const conflict = db.prepare(`
        SELECT si.*, d.name as department_name, m.name as member_name
        FROM schedule_items si
        JOIN schedules s ON si.schedule_id = s.id
        JOIN departments d ON s.department_id = d.id
        JOIN members m ON si.member_id = m.id
        WHERE si.member_id = ? AND si.date = ? AND si.schedule_id != ?
        LIMIT 1
      `).get(it.member_id, it.date, id) as any;

      if (conflict) {
        return NextResponse.json({
          success: false,
          error: `Conflito de escala: O membro "${conflict.member_name}" já está escalado(a) no departamento "${conflict.department_name}" no dia ${it.date}. Não é permitida duplicidade de membro no mesmo dia.`
        }, { status: 400 });
      }
    }
  }

  db.prepare(`
    UPDATE schedules
    SET title = ?, month_year = ?, author_name = ?, notes = ?, status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    title !== undefined ? title : existing.title,
    month_year !== undefined ? month_year : existing.month_year,
    author_name !== undefined ? author_name : existing.author_name,
    notes !== undefined ? notes : existing.notes,
    status !== undefined ? status : existing.status,
    id
  );

  if (Array.isArray(items)) {
    db.prepare("DELETE FROM schedule_items WHERE schedule_id = ?").run(id);
    const insertItem = db.prepare(`
      INSERT INTO schedule_items (id, schedule_id, date, service_type, role_id, member_id, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const item of items) {
      if (!item.date || !item.role_id || !item.member_id) continue;
      const itemId = item.id || "item_" + Math.random().toString(36).slice(2, 9);
      insertItem.run(
        itemId,
        id,
        item.date,
        item.service_type || "Culto de Sábado",
        item.role_id,
        item.member_id,
        item.notes || ""
      );
    }
  }

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
    const { id } = await context.params;
    const body = await request.json();
    const { schedule_item_id, new_member_id, notes, user_id, user_phone, pin } = body;

    if (!schedule_item_id || !new_member_id) {
      return NextResponse.json({ success: false, error: "Item da escala e novo membro são obrigatórios." }, { status: 400 });
    }

    const supabase = getServiceRoleClient() || getSupabase();
    if (supabase) {
      const { data: schedule } = await supabase.from("schedules").select("*").eq("id", id).maybeSingle();
      if (!schedule) {
        return NextResponse.json({ success: false, error: "Escala não encontrada" }, { status: 404 });
      }

      const auth = await checkLeaderAuth({ user_id, user_phone, pin }, schedule);
      if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.reason || "Acesso restrito." }, { status: 403 });
      }

      const { data: item } = await supabase.from("schedule_items").select("*").eq("id", schedule_item_id).maybeSingle();
      if (!item) {
        return NextResponse.json({ success: false, error: "Item de escala não encontrado." }, { status: 404 });
      }

      // 1. Checar duplicidade interna na mesma data
      const { data: intraDuplicate } = await supabase
        .from("schedule_items")
        .select("id, members(name)")
        .eq("schedule_id", id)
        .eq("date", item.date)
        .eq("member_id", new_member_id)
        .neq("id", schedule_item_id)
        .maybeSingle();

      if (intraDuplicate) {
        return NextResponse.json({
          success: false,
          error: "Não é permitida duplicidade: Este membro já está alocado nesta mesma data nesta escala."
        }, { status: 400 });
      }

      // 2. Checar conflito geral com outros departamentos nesta mesma data
      const { data: crossConflict } = await supabase
        .from("schedule_items")
        .select("id, schedules(departments(name)), members(name)")
        .neq("schedule_id", id)
        .eq("date", item.date)
        .eq("member_id", new_member_id)
        .maybeSingle();

      if (crossConflict) {
        const mName = (crossConflict as any).members?.name || "Este membro";
        const dName = (crossConflict as any).schedules?.departments?.name || "outro departamento";
        return NextResponse.json({
          success: false,
          error: `Conflito de escala: ${mName} já está escalado(a) no departamento "${dName}" no dia ${item.date}. Não é permitida duplicidade de membro no mesmo dia.`
        }, { status: 400 });
      }

      const updatePayload: any = { member_id: new_member_id };
      if (notes !== undefined) updatePayload.notes = notes;

      await supabase.from("schedule_items").update(updatePayload).eq("id", schedule_item_id);
      return NextResponse.json({ success: true, message: "Membro atualizado na escala com sucesso!" });
    }

    // SQLite
    const schedule = db.prepare("SELECT * FROM schedules WHERE id = ?").get(id) as any;
    if (!schedule) {
      return NextResponse.json({ success: false, error: "Escala não encontrada" }, { status: 404 });
    }

    const auth = await checkLeaderAuth({ user_id, user_phone, pin }, schedule);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.reason || "Acesso restrito." }, { status: 403 });
    }

    const item = db.prepare("SELECT * FROM schedule_items WHERE id = ?").get(schedule_item_id) as any;
    if (!item) {
      return NextResponse.json({ success: false, error: "Item de escala não encontrado." }, { status: 404 });
    }

    // 1. Duplicidade interna
    const intraDuplicate = db.prepare(`
      SELECT id FROM schedule_items
      WHERE schedule_id = ? AND date = ? AND member_id = ? AND id != ?
    `).get(id, item.date, new_member_id, schedule_item_id);

    if (intraDuplicate) {
      return NextResponse.json({
        success: false,
        error: "Não é permitida duplicidade: Este membro já está alocado nesta mesma data nesta escala."
      }, { status: 400 });
    }

    // 2. Conflito externo
    const crossConflict = db.prepare(`
      SELECT si.*, d.name as department_name, m.name as member_name
      FROM schedule_items si
      JOIN schedules s ON si.schedule_id = s.id
      JOIN departments d ON s.department_id = d.id
      JOIN members m ON si.member_id = m.id
      WHERE si.member_id = ? AND si.date = ? AND si.schedule_id != ?
      LIMIT 1
    `).get(new_member_id, item.date, id) as any;

    if (crossConflict) {
      return NextResponse.json({
        success: false,
        error: `Conflito de escala: ${crossConflict.member_name} já está escalado(a) no departamento "${crossConflict.department_name}" no dia ${item.date}. Não é permitida duplicidade de membro no mesmo dia.`
      }, { status: 400 });
    }

    if (notes !== undefined) {
      db.prepare("UPDATE schedule_items SET member_id = ?, notes = ? WHERE id = ?").run(new_member_id, notes, schedule_item_id);
    } else {
      db.prepare("UPDATE schedule_items SET member_id = ? WHERE id = ?").run(new_member_id, schedule_item_id);
    }

    return NextResponse.json({ success: true, message: "Membro atualizado na escala com sucesso!" });
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

    const supabase = getServiceRoleClient() || getSupabase();
    if (supabase) {
      const { data: schedule } = await supabase.from("schedules").select("*").eq("id", id).maybeSingle();
      if (!schedule) {
        return NextResponse.json({ success: false, error: "Escala não encontrada" }, { status: 404 });
      }

      let isAuthorized = false;
      const configuredAdminPin = process.env.ADMIN_PIN?.trim();
      if (configuredAdminPin && pin && pin.trim() === configuredAdminPin) {
        isAuthorized = true;
      } else if (phone) {
        const cleanPhone = phone.replace(/\D/g, "");
        const { data: mData } = await supabase.from("members").select("*").eq("phone", cleanPhone).maybeSingle();
        if (mData && (mData.is_leader || mData.name.trim().toLowerCase() === (schedule.author_name || "").trim().toLowerCase())) {
          isAuthorized = true;
        }
      }

      if (!isAuthorized) {
        return NextResponse.json({
          success: false,
          error: `Acesso restrito: Apenas o responsável pela elaboração desta escala ou um administrador pode excluí-la.`
        }, { status: 403 });
      }

      await supabase.from("schedules").delete().eq("id", id);
      return NextResponse.json({ success: true, message: "Escala excluída com sucesso" });
    }

    const schedule = db.prepare("SELECT * FROM schedules WHERE id = ?").get(id) as any;
    if (!schedule) {
      return NextResponse.json({ success: false, error: "Escala não encontrada" }, { status: 404 });
    }

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