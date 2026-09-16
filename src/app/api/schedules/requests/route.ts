import { NextResponse } from "next/server";
import { getSupabase, getServiceRoleClient } from "@/lib/supabase";
import db from "@/lib/db";

// Listar solicitações
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const schedule_id = searchParams.get("schedule_id");
    const status = searchParams.get("status") || "pending";

    const supabase = getServiceRoleClient() || getSupabase();
    if (supabase) {
      let query = supabase
        .from("schedule_requests")
        .select(`
          *,
          schedule_items!inner(id, date, service_type, schedule_id, roles(name)),
          members!schedule_requests_member_id_fkey(id, name, phone),
          target_member:members!schedule_requests_target_member_id_fkey(id, name, phone)
        `)
        .order("created_at", { ascending: false });

      if (schedule_id) {
        query = query.eq("schedule_items.schedule_id", schedule_id);
      }
      if (status !== "all") {
        query = query.eq("status", status);
      }

      const { data, error } = await query;
      if (error) {
        // Fallback para consulta direta caso o relacionamento use nomes diferentes
        const { data: simpleData, error: sErr } = await supabase
          .from("schedule_requests")
          .select("*")
          .order("created_at", { ascending: false });

        if (sErr) throw sErr;

        const [itemsRes, membersRes] = await Promise.all([
          supabase.from("schedule_items").select("id, date, service_type, schedule_id, roles(name)"),
          supabase.from("members").select("id, name, phone")
        ]);

        const itemMap = new Map((itemsRes.data || []).map(i => [i.id, i]));
        const memberMap = new Map((membersRes.data || []).map(m => [m.id, m]));

        let filtered = simpleData || [];
        if (schedule_id) {
          filtered = filtered.filter(sr => itemMap.get(sr.schedule_item_id)?.schedule_id === schedule_id);
        }
        if (status !== "all") {
          filtered = filtered.filter(sr => sr.status === status);
        }

        const formatted = filtered.map(sr => {
          const it: any = itemMap.get(sr.schedule_item_id);
          const m = memberMap.get(sr.member_id);
          const tm = sr.target_member_id ? memberMap.get(sr.target_member_id) : null;
          return {
            ...sr,
            date: it?.date || "",
            service_type: it?.service_type || "",
            role_name: it?.roles?.name || "",
            member_name: m?.name || "",
            member_phone: m?.phone || "",
            target_member_name: tm?.name || "",
            target_member_phone: tm?.phone || ""
          };
        });

        return NextResponse.json({ success: true, data: formatted });
      }

      const formatted = (data || []).map((sr: any) => ({
        ...sr,
        date: sr.schedule_items?.date || "",
        service_type: sr.schedule_items?.service_type || "",
        role_name: sr.schedule_items?.roles?.name || "",
        member_name: sr.members?.name || "",
        member_phone: sr.members?.phone || "",
        target_member_name: sr.target_member?.name || "",
        target_member_phone: sr.target_member?.phone || ""
      }));

      return NextResponse.json({ success: true, data: formatted });
    }

    let query = `
      SELECT 
        sr.*,
        si.date,
        si.service_type,
        r.name as role_name,
        m.name as member_name,
        m.phone as member_phone,
        tm.name as target_member_name,
        tm.phone as target_member_phone
      FROM schedule_requests sr
      JOIN schedule_items si ON sr.schedule_item_id = si.id
      JOIN roles r ON si.role_id = r.id
      JOIN members m ON sr.member_id = m.id
      LEFT JOIN members tm ON sr.target_member_id = tm.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (schedule_id) {
      query += ` AND si.schedule_id = ?`;
      params.push(schedule_id);
    }
    if (status !== "all") {
      query += ` AND sr.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY sr.created_at DESC`;

    const requests = db.prepare(query).all(...params);
    return NextResponse.json({ success: true, data: requests });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Criar solicitação de ausência ou troca
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { schedule_item_id, member_id, request_type, target_member_id, reason } = body;

    if (!schedule_item_id || !member_id || !request_type) {
      return NextResponse.json({
        success: false,
        error: "Dados incompletos para a solicitação."
      }, { status: 400 });
    }

    const supabase = getServiceRoleClient() || getSupabase();
    if (supabase) {
      // 1. Verificar se o item existe no Supabase
      const { data: item, error: itemErr } = await supabase
        .from("schedule_items")
        .select("*")
        .eq("id", schedule_item_id)
        .maybeSingle();

      if (itemErr || !item) {
        return NextResponse.json({ success: false, error: "Item de escala não encontrado." }, { status: 404 });
      }

      if (item.member_id !== member_id) {
        return NextResponse.json({
          success: false,
          error: "Você só pode solicitar ausência ou troca para uma função onde esteja escalado."
        }, { status: 403 });
      }

      const reqId = "req_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

      const { error: insErr } = await supabase.from("schedule_requests").insert({
        id: reqId,
        schedule_item_id,
        member_id,
        request_type,
        target_member_id: target_member_id || null,
        reason: reason || "",
        status: "pending"
      });

      if (insErr) throw insErr;

      return NextResponse.json({
        success: true,
        message: request_type === "absence"
          ? "Aviso de ausência enviado ao líder da escala."
          : "Pedido de troca enviado para aprovação do líder."
      });
    }

    // Fallback SQLite Local
    const item = db.prepare("SELECT * FROM schedule_items WHERE id = ?").get(schedule_item_id) as any;
    if (!item) {
      return NextResponse.json({ success: false, error: "Item de escala não encontrado." }, { status: 404 });
    }

    if (item.member_id !== member_id) {
      return NextResponse.json({
        success: false,
        error: "Você só pode solicitar ausência ou troca para uma função onde esteja escalado."
      }, { status: 403 });
    }

    const reqId = "req_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

    db.prepare(`
      INSERT INTO schedule_requests (id, schedule_item_id, member_id, request_type, target_member_id, reason, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `).run(reqId, schedule_item_id, member_id, request_type, target_member_id || null, reason || "");

    return NextResponse.json({
      success: true,
      message: request_type === "absence" ? "Aviso de ausência enviado ao líder da escala." : "Pedido de troca enviado para aprovação do líder."
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

async function checkLeaderAuth(
  authData: { user_id?: string; user_phone?: string; pin?: string },
  schedule: { author_name?: string; department_id?: string; department_name?: string }
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
    let q = supabase.from("members").select("id, name, is_leader").limit(1);
    if (user_id) q = q.eq("id", user_id);
    else if (cleanPhone) q = q.eq("phone", cleanPhone);
    const { data: mData } = await q;
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
      const deptName = schedule.department_name || "deste departamento";
      return {
        authorized: false,
        reason: `Acesso restrito: Você não é líder do departamento "${deptName}". Somente o responsável indicado pode autorizar trocas ou ausências dele.`
      };
    }

    return { authorized: false, reason: "Acesso restrito: Apenas o líder responsável pode autorizar solicitações desta escala." };
  }

  const member = db.prepare(`
    SELECT m.*
    FROM members m
    WHERE (m.id = ? AND ? != '') OR (m.phone = ? AND ? != '')
  `).get(user_id || "", user_id || "", cleanPhone, cleanPhone) as any;

  if (!member) {
    return { authorized: false, reason: "Membro não encontrado." };
  }

  // Autor da escala
  if (schedule.author_name && member.name.trim().toLowerCase() === schedule.author_name.trim().toLowerCase()) {
    return { authorized: true };
  }

  // Líder do departamento da escala
  if (schedule.department_id) {
    const isDeptLeader = db.prepare(`
      SELECT COUNT(*) as count 
      FROM member_departments 
      WHERE member_id = ? AND department_id = ? AND is_department_leader = 1
    `).get(member.id, schedule.department_id) as { count: number };

    if (isDeptLeader && isDeptLeader.count > 0) {
      return { authorized: true };
    }

    const deptName = schedule.department_name || "deste departamento";
    return {
      authorized: false,
      reason: `Acesso restrito: Você não é líder do departamento "${deptName}". Somente o responsável indicado pode autorizar trocas ou ausências dele.`
    };
  }

  return { authorized: false, reason: "Acesso restrito: Apenas o líder responsável pode autorizar solicitações desta escala." };
}

// Aprovar ou Rejeitar solicitação (apenas líder / responsável)
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { request_id, action, reviewed_by, replacement_member_id, user_id, user_phone, pin } = body;

    if (!request_id || !action) {
      return NextResponse.json({ success: false, error: "Parâmetros inválidos" }, { status: 400 });
    }

    const supabase = getServiceRoleClient() || getSupabase();
    if (supabase) {
      const { data: req, error: reqErr } = await supabase
        .from("schedule_requests")
        .select(`
          *,
          schedule_items!inner(id, schedule_id, date, role_id, member_id, schedules(author_name, department_id, departments(name)))
        `)
        .eq("id", request_id)
        .maybeSingle();

      if (reqErr || !req) {
        return NextResponse.json({ success: false, error: "Solicitação não encontrada." }, { status: 404 });
      }

      const scheduleData = req.schedule_items?.schedules;
      const auth = await checkLeaderAuth({ user_id, user_phone, pin }, {
        author_name: scheduleData?.author_name,
        department_id: scheduleData?.department_id,
        department_name: scheduleData?.departments?.name
      });

      if (!auth.authorized) {
        return NextResponse.json({
          success: false,
          error: auth.reason || "Acesso restrito: Apenas o líder responsável por este departamento pode avaliar solicitações de escala."
        }, { status: 403 });
      }

      const newStatus = action === "approve" ? "approved" : "rejected";

      await supabase
        .from("schedule_requests")
        .update({
          status: newStatus,
          reviewed_by: reviewed_by || "Líder",
          reviewed_at: new Date().toISOString()
        })
        .eq("id", request_id);

      if (action === "approve") {
        const finalMemberId = replacement_member_id || (req.request_type === "swap" ? req.target_member_id : null);
        if (finalMemberId) {
          const { data: newMember } = await supabase.from("members").select("name").eq("id", finalMemberId).maybeSingle();
          const noteText = req.request_type === "absence"
            ? `Substituto definido pelo responsável: ${newMember?.name || "Novo membro"}`
            : `Troca confirmada: ${newMember?.name || "Substituto"}`;

          await supabase
            .from("schedule_items")
            .update({ member_id: finalMemberId, notes: noteText })
            .eq("id", req.schedule_item_id);
        } else if (req.request_type === "absence") {
          const { data: origMember } = await supabase.from("members").select("name").eq("id", req.member_id).maybeSingle();
          await supabase
            .from("schedule_items")
            .update({
              member_id: null,
              notes: `Pendente: Ausência de ${origMember?.name || "voluntário"} aprovada. Aguardando nova pessoa.`
            })
            .eq("id", req.schedule_item_id);
        }
      }

      let successMsg = "Solicitação aprovada com sucesso!";
      if (action === "approve") {
        if (replacement_member_id) {
          successMsg = "Nova pessoa definida e escala atualizada com sucesso!";
        } else if (req.request_type === "absence") {
          successMsg = "Ausência aprovada! O voluntário foi retirado da escala e a data permanece pendente até a definição de uma nova pessoa.";
        }
      } else {
        successMsg = "Solicitação rejeitada.";
      }

      return NextResponse.json({ success: true, message: successMsg });
    }

    // Fallback SQLite Local
    const req = db.prepare(`
      SELECT sr.*, s.author_name, s.department_id, d.name as department_name
      FROM schedule_requests sr
      JOIN schedule_items si ON sr.schedule_item_id = si.id
      JOIN schedules s ON si.schedule_id = s.id
      JOIN departments d ON s.department_id = d.id
      WHERE sr.id = ?
    `).get(request_id) as any;

    if (!req) {
      return NextResponse.json({ success: false, error: "Solicitação não encontrada." }, { status: 404 });
    }

    const auth = await checkLeaderAuth({ user_id, user_phone, pin }, req);
    if (!auth.authorized) {
      return NextResponse.json({
        success: false,
        error: auth.reason || "Acesso restrito: Apenas o líder responsável por este departamento pode avaliar solicitações de escala."
      }, { status: 403 });
    }

    const newStatus = action === "approve" ? "approved" : "rejected";

    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE schedule_requests
        SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newStatus, reviewed_by || "Líder", request_id);

      if (action === "approve") {
        const finalMemberId = replacement_member_id || (req.request_type === "swap" ? req.target_member_id : null);
        if (finalMemberId) {
          const newMember = db.prepare("SELECT name FROM members WHERE id = ?").get(finalMemberId) as any;
          const noteText = req.request_type === "absence"
            ? `Substituto definido pelo responsável: ${newMember?.name || "Novo membro"}`
            : `Troca confirmada: ${newMember?.name || "Substituto"}`;

          db.prepare(`
            UPDATE schedule_items
            SET member_id = ?, notes = ?
            WHERE id = ?
          `).run(finalMemberId, noteText, req.schedule_item_id);
        } else if (req.request_type === "absence") {
          const origMember = db.prepare("SELECT name FROM members WHERE id = ?").get(req.member_id) as any;
          db.prepare(`
            UPDATE schedule_items
            SET member_id = NULL, notes = ?
            WHERE id = ?
          `).run(
            `Pendente: Ausência de ${origMember?.name || "voluntário"} aprovada. Aguardando nova pessoa.`,
            req.schedule_item_id
          );
        }
      }
    });

    tx();

    let successMsg = "Solicitação aprovada com sucesso!";
    if (action === "approve") {
      if (replacement_member_id) {
        successMsg = "Nova pessoa definida e escala atualizada com sucesso!";
      } else if (req.request_type === "absence") {
        successMsg = "Ausência aprovada! O voluntário foi retirado da escala e a data permanece pendente até a definição de uma nova pessoa.";
      }
    } else {
      successMsg = "Solicitação rejeitada.";
    }

    return NextResponse.json({
      success: true,
      message: successMsg
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}