import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawInput = (body.phone || body.identifier || "").trim();
    const allDepts = db.prepare("SELECT id, name FROM departments").all() as { id: string; name: string }[];

    const configuredAdminPin = process.env.ADMIN_PIN?.trim();
    if (configuredAdminPin && rawInput === configuredAdminPin) {
      return NextResponse.json({
        success: true,
        data: {
          id: "m_admin_leader",
          name: "Administrador / Líder Geral",
          phone: "admin",
          email: "admin@iasd.org",
          is_leader: true,
          is_general_admin: true,
          led_department_ids: allDepts.map(d => d.id),
          led_department_names: allDepts.map(d => d.name),
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

    // Validação de Senha
    // Se o membro tiver uma senha personalizada no banco, ela é exigida.
    // Caso contrário, a senha padrão é o próprio número de WhatsApp do membro.
    const inputPassword = (body.password || "").trim();
    if (!inputPassword) {
      return NextResponse.json({
        success: false,
        error: "Por favor, informe sua senha de acesso."
      }, { status: 400 });
    }

    if (member.password && member.password.trim().length > 0) {
      if (inputPassword !== member.password) {
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

    // Identificar departamentos onde o membro é líder designado
    const ledDepts = db.prepare(`
      SELECT d.id, d.name
      FROM member_departments md
      JOIN departments d ON md.department_id = d.id
      WHERE md.member_id = ? AND md.is_department_leader = 1
    `).all(member.id) as { id: string; name: string }[];

    let finalLedDeptIds = ledDepts.map(d => d.id);
    let finalLedDeptNames = ledDepts.map(d => d.name);

    if (finalLedDeptIds.length === 0 && member.is_leader === 1) {
      // Caso tenha flag is_leader geral, vincular aos departamentos cadastrados
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
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}