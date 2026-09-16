import { NextResponse } from "next/server";
import { getSupabase, getServiceRoleClient } from "@/lib/supabase";
import db from "@/lib/db";

const DEFAULT_IASD_DEPTS = [
  { id: "diaconato", name: "Diaconato" },
  { id: "sonoplastia", name: "Sonoplastia e Mídia" },
  { id: "recepcao", name: "Recepção" },
  { id: "escola_sabatina", name: "Escola Sabatina" },
  { id: "ministerio_louvor", name: "Ministério de Música e Louvor" },
  { id: "anciaos", name: "Ancionato / Direção" }
];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawInput = (body.phone || body.identifier || "").trim();

    // 1. Verificação Imediata do PIN de Administrador Geral (sem travar por dependência de banco)
    const configuredAdminPin = process.env.ADMIN_PIN?.trim();
    if (configuredAdminPin && rawInput === configuredAdminPin) {
      let deptList = DEFAULT_IASD_DEPTS;

      const supabase = getServiceRoleClient() || getSupabase();
      if (supabase) {
        try {
          const { data } = await supabase.from("departments").select("id, name");
          if (data && data.length > 0) deptList = data;
        } catch {
          // Mantém a lista padrão se a requisição falhar
        }
      } else {
        try {
          const rows = db.prepare("SELECT id, name FROM departments").all() as { id: string; name: string }[];
          if (rows && rows.length > 0) deptList = rows;
        } catch {
          // Mantém a lista padrão
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          id: "m_admin_leader",
          name: "Administrador / Líder Geral",
          phone: "admin",
          email: "admin@iasd.org",
          is_leader: true,
          is_general_admin: true,
          led_department_ids: deptList.map(d => d.id),
          led_department_names: deptList.map(d => d.name),
          is_author: true,
          authored_schedules_count: 99,
          roles: []
        }
      });
    }

    const cleanPhone = rawInput.replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length < 10) {
      return NextResponse.json({
        success: false,
        error: "Número de WhatsApp inválido. Digite DDD + Número ou o PIN da liderança."
      }, { status: 400 });
    }

    const inputPassword = (body.password || "").trim();
    if (!inputPassword) {
      return NextResponse.json({
        success: false,
        error: "Por favor, informe sua senha de acesso."
      }, { status: 400 });
    }

    const supabase = getServiceRoleClient() || getSupabase();

    // 2. Fluxo via Supabase (Cloudflare / Produção)
    if (supabase) {
      const { data: members, error: memberErr } = await supabase
        .from("members")
        .select("*")
        .eq("phone", cleanPhone)
        .order("is_child", { ascending: true })
        .limit(1);

      if (memberErr || !members || members.length === 0) {
        return NextResponse.json({
          success: false,
          error: "Número não encontrado no cadastro de membros. Fale com o responsável pelo departamento para cadastrar seu número."
        }, { status: 404 });
      }

      const member = members[0];
      const memberPass = member.password_hash || member.password;

      // Validação de senha
      if (memberPass && String(memberPass).trim().length > 0) {
        if (inputPassword !== String(memberPass).trim()) {
          return NextResponse.json({
            success: false,
            error: "Senha incorreta. Verifique os dados e tente novamente."
          }, { status: 401 });
        }
      } else {
        const cleanInputPass = inputPassword.replace(/\D/g, "");
        const cleanMemberPhone = (member.phone || "").replace(/\D/g, "");
        if (inputPassword !== member.phone && cleanInputPass !== cleanMemberPhone) {
          return NextResponse.json({
            success: false,
            error: "Senha incorreta. Verifique os dados e tente novamente."
          }, { status: 401 });
        }
      }

      // Buscar departamentos e funções do membro
      const [rolesRes, deptsRes, allDeptsRes, schedCountRes] = await Promise.all([
        supabase.from("member_roles").select("role_id").eq("member_id", member.id),
        supabase.from("member_departments").select("department_id, is_department_leader").eq("member_id", member.id),
        supabase.from("departments").select("id, name"),
        supabase.from("schedules").select("id", { count: "exact", head: true }).eq("author_name", member.name)
      ]);

      const deptMap = new Map((allDeptsRes.data || []).map(d => [d.id, d.name]));
      const memberDeptRows = deptsRes.data || [];
      const ledDepts = memberDeptRows.filter(md => md.is_department_leader);

      let finalLedDeptIds = ledDepts.map(d => d.department_id);
      let finalLedDeptNames = finalLedDeptIds.map(id => deptMap.get(id) || id);

      if (finalLedDeptIds.length === 0 && member.is_leader) {
        finalLedDeptIds = memberDeptRows.map(d => d.department_id);
        finalLedDeptNames = finalLedDeptIds.map(id => deptMap.get(id) || id);
      }

      // Buscar detalhes dos roles
      let rolesData: any[] = [];
      const roleIds = (rolesRes.data || []).map(r => r.role_id);
      if (roleIds.length > 0) {
        const { data: rolesInfo } = await supabase
          .from("roles")
          .select("id, name, department_id")
          .in("id", roleIds);

        rolesData = (rolesInfo || []).map(r => ({
          id: r.id,
          name: r.name,
          department_id: r.department_id,
          department_name: deptMap.get(r.department_id) || ""
        }));
      }

      const isLeader = finalLedDeptIds.length > 0 || Boolean(member.is_leader);

      return NextResponse.json({
        success: true,
        data: {
          id: member.id,
          name: member.name,
          phone: member.phone,
          email: member.email,
          is_leader: isLeader,
          is_general_admin: false,
          led_department_ids: finalLedDeptIds,
          led_department_names: finalLedDeptNames,
          is_author: Boolean((schedCountRes.count || 0) > 0),
          authored_schedules_count: Number(schedCountRes.count || 0),
          roles: rolesData
        }
      });
    }

    // 3. Fallback para SQLite Local (Desenvolvimento offline)
    const member = db.prepare(`
      SELECT m.*, 
        (SELECT COUNT(*) FROM schedules s WHERE s.author_name = m.name) as authored_schedules
      FROM members m 
      WHERE m.phone = ?
      ORDER BY CASE WHEN m.is_child = 0 OR m.is_child IS NULL THEN 0 ELSE 1 END, m.created_at ASC
      LIMIT 1
    `).get(cleanPhone) as any;

    if (!member) {
      return NextResponse.json({
        success: false,
        error: "Número não encontrado no cadastro de membros. Fale com o responsável pelo departamento para cadastrar seu número."
      }, { status: 404 });
    }

    const memberPassword = member.password_hash || member.password;
    if (memberPassword && memberPassword.trim().length > 0) {
      if (inputPassword !== memberPassword) {
        return NextResponse.json({
          success: false,
          error: "Senha incorreta. Verifique os dados e tente novamente."
        }, { status: 401 });
      }
    } else {
      const cleanInputPass = inputPassword.replace(/\D/g, "");
      const cleanMemberPhone = (member.phone || "").replace(/\D/g, "");
      if (inputPassword !== member.phone && cleanInputPass !== cleanMemberPhone) {
        return NextResponse.json({
          success: false,
          error: "Senha incorreta. Verifique os dados e tente novamente."
        }, { status: 401 });
      }
    }

    const roles = db.prepare(`
      SELECT r.id, r.name, d.name as department_name, d.id as department_id
      FROM member_roles mr
      JOIN roles r ON mr.role_id = r.id
      JOIN departments d ON r.department_id = d.id
      WHERE mr.member_id = ?
    `).all(member.id);

    const ledDepts = db.prepare(`
      SELECT d.id, d.name
      FROM member_departments md
      JOIN departments d ON md.department_id = d.id
      WHERE md.member_id = ? AND md.is_department_leader = 1
    `).all(member.id) as { id: string; name: string }[];

    let finalLedDeptIds = ledDepts.map(d => d.id);
    let finalLedDeptNames = ledDepts.map(d => d.name);

    if (finalLedDeptIds.length === 0 && member.is_leader === 1) {
      const memberDepts = db.prepare(`
        SELECT d.id, d.name
        FROM member_departments md
        JOIN departments d ON md.department_id = d.id
        WHERE md.member_id = ?
      `).all(member.id) as { id: string; name: string }[];

      if (memberDepts.length > 0) {
        finalLedDeptIds = memberDepts.map(d => d.id);
        finalLedDeptNames = memberDepts.map(d => d.name);
      }
    }

    const isLeader = finalLedDeptIds.length > 0;

    return NextResponse.json({
      success: true,
      data: {
        id: member.id,
        name: member.name,
        phone: member.phone,
        email: member.email,
        is_leader: isLeader,
        is_general_admin: false,
        led_department_ids: finalLedDeptIds,
        led_department_names: finalLedDeptNames,
        is_author: Boolean(member.authored_schedules > 0),
        authored_schedules_count: Number(member.authored_schedules || 0),
        roles
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Erro interno no servidor." }, { status: 500 });
  }
}