import { NextResponse } from "next/server";
import { getSupabase, getServiceRoleClient } from "@/lib/supabase";
import db from "@/lib/db";

export async function GET() {
  try {
    const supabase = getSupabase();
    if (supabase) {
      const [membersRes, rolesRes, deptsRes] = await Promise.all([
        supabase.from("members").select("*").order("name", { ascending: true }),
        supabase.from("member_roles").select("member_id, role_id, roles(id, name, department_id, departments(name, color))"),
        supabase.from("member_departments").select("member_id, department_id, is_department_leader, departments(name, color)")
      ]);

      const allMembers = membersRes.data || [];
      const memberMap = new Map(allMembers.map(m => [m.id, m]));

      const formatted = allMembers.map((m: any) => {
        const { password, password_hash, ...safeMember } = m;
        const parent = m.parent_id ? memberMap.get(m.parent_id) : null;

        const mRoles = (rolesRes.data || [])
          .filter((r: any) => r.member_id === m.id)
          .map((r: any) => ({
            role_id: r.role_id,
            role_name: r.roles?.name || "",
            department_id: r.roles?.department_id || "",
            department_name: r.roles?.departments?.name || "",
            department_color: r.roles?.departments?.color || "#002F6C"
          }));

        const mDepts = (deptsRes.data || [])
          .filter((d: any) => d.member_id === m.id)
          .map((d: any) => ({
            department_id: d.department_id,
            is_department_leader: Boolean(d.is_department_leader),
            department_name: d.departments?.name || "",
            department_color: d.departments?.color || "#002F6C"
          }));

        const children = allMembers
          .filter((c: any) => c.parent_id === m.id)
          .map((c: any) => ({ id: c.id, name: c.name }));

        return {
          ...safeMember,
          is_active: Boolean(m.is_active),
          is_leader: Boolean(m.is_leader),
          is_child: Boolean(m.is_child),
          parent_id: m.parent_id || null,
          parent_name: parent?.name || "",
          parent_phone: parent?.phone || "",
          leader_status: m.leader_status || (m.is_leader ? "approved" : "none"),
          leader_nominated_by: m.leader_nominated_by || "",
          roles: mRoles,
          departments: mDepts,
          children
        };
      });

      return NextResponse.json({ success: true, data: formatted });
    }

    const members = db.prepare(`
      SELECT m.*, p.name as parent_name, p.phone as parent_phone
      FROM members m
      LEFT JOIN members p ON m.parent_id = p.id
      ORDER BY m.name ASC
    `).all();

    const memberRoles = db.prepare(`
      SELECT mr.member_id, r.id as role_id, r.name as role_name, r.department_id, d.name as department_name, d.color as department_color
      FROM member_roles mr
      JOIN roles r ON mr.role_id = r.id
      JOIN departments d ON r.department_id = d.id
    `).all();

    const memberDepts = db.prepare(`
      SELECT md.member_id, md.department_id, md.is_department_leader, d.name as department_name, d.color as department_color
      FROM member_departments md
      JOIN departments d ON md.department_id = d.id
    `).all();

    const formatted = members.map((m: any) => {
      const { password, ...safeMember } = m;
      return {
        ...safeMember,
        is_active: Boolean(m.is_active),
        is_leader: Boolean(m.is_leader),
        is_child: Boolean(m.is_child),
        parent_id: m.parent_id || null,
        parent_name: m.parent_name || "",
        parent_phone: m.parent_phone || "",
        leader_status: m.leader_status || (m.is_leader ? "approved" : "none"),
        leader_nominated_by: m.leader_nominated_by || "",
        roles: memberRoles.filter((r: any) => r.member_id === m.id),
        departments: memberDepts.filter((d: any) => d.member_id === m.id),
        children: members.filter((c: any) => c.parent_id === m.id).map((c: any) => ({ id: c.id, name: c.name }))
      };
    });

    return NextResponse.json({ success: true, data: formatted });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

interface LeaderAuthResult {
  isAuthorized: boolean;
  isGeneralAdmin: boolean;
  userName: string;
}

async function getLeaderAuthDetails(authData: { user_id?: string; user_phone?: string; pin?: string }): Promise<LeaderAuthResult> {
  const { user_id, user_phone, pin } = authData;
  const rawPin = (pin || "").trim();
  const cleanPhone = user_phone ? user_phone.replace(/\D/g, "") : "";
  const configuredPin = process.env.ADMIN_PIN?.trim();

  // Administrador Geral não tem qualquer restrição e é reconhecido por PIN oficial ou ID
  if (
    (configuredPin && (rawPin === configuredPin || cleanPhone === configuredPin)) ||
    user_id === "m_admin_leader"
  ) {
    return { isAuthorized: true, isGeneralAdmin: true, userName: "Administrador Geral" };
  }
  if (!user_id && !user_phone) {
    return { isAuthorized: false, isGeneralAdmin: false, userName: "" };
  }

  const supabase = getServiceRoleClient() || getSupabase();
  if (supabase) {
    let q = supabase.from("members").select("id, name, is_leader").limit(1);
    if (user_id) q = q.eq("id", user_id);
    else if (cleanPhone) q = q.eq("phone", cleanPhone);
    const { data: mData } = await q;
    if (!mData || mData.length === 0) return { isAuthorized: false, isGeneralAdmin: false, userName: "" };
    const member = mData[0];
    return { isAuthorized: Boolean(member.is_leader), isGeneralAdmin: false, userName: member.name || "Líder" };
  }

  const member = db.prepare(`
    SELECT m.*,
      (SELECT COUNT(*) FROM member_departments md WHERE md.member_id = m.id AND md.is_department_leader = 1) as is_dept_leader,
      (SELECT COUNT(*) FROM schedules s WHERE s.author_name = m.name) as authored_schedules
    FROM members m
    WHERE (m.id = ? AND ? != '') OR (m.phone = ? AND ? != '')
  `).get(user_id || "", user_id || "", cleanPhone, cleanPhone) as any;

  if (!member) {
    return { isAuthorized: false, isGeneralAdmin: false, userName: "" };
  }

  const isAuthorized = Boolean(member.is_leader === 1 || member.is_dept_leader > 0 || member.authored_schedules > 0);
  return { isAuthorized, isGeneralAdmin: false, userName: member.name || "Líder" };
}


export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      name, phone, email, is_active, is_leader, is_child, parent_id,
      role_ids, department_ids, leader_department_ids, user_id, user_phone, pin 
    } = body;

    const auth = await getLeaderAuthDetails({ user_id, user_phone, pin });
    // Apenas líder / responsável autenticado pode cadastrar membros
    if (!auth.isAuthorized) {
      return NextResponse.json({
        success: false,
        error: "Acesso restrito: Somente um líder ou responsável autenticado pode cadastrar novos membros."
      }, { status: 403 });
    }

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: "Nome do membro é obrigatório." }, { status: 400 });
    }

    const isChild = Boolean(is_child);
    let cleanPhone = (phone || "").replace(/\D/g, "");
    let effectiveParentId: string | null = null;

    if (isChild) {
      if (!parent_id) {
        return NextResponse.json({
          success: false,
          error: "Para cadastrar uma criança sem telefone próprio, selecione o responsável cadastrado."
        }, { status: 400 });
      }
      const parent = db.prepare("SELECT * FROM members WHERE id = ?").get(parent_id) as any;
      if (!parent) {
        return NextResponse.json({ success: false, error: "Responsável selecionado não encontrado." }, { status: 404 });
      }
      // O membro infantil é cadastrado no número já cadastrado do responsável
      cleanPhone = parent.phone;
      effectiveParentId = parent.id;
    } else {
      if (!cleanPhone || cleanPhone.length < 10) {
        return NextResponse.json({ success: false, error: "Informe um número de WhatsApp válido com DDD." }, { status: 400 });
      }
      // Checar se já existe outro membro adulto titular com o mesmo telefone
      const existingAdult = db.prepare("SELECT * FROM members WHERE phone = ? AND (is_child = 0 OR is_child IS NULL)").get(cleanPhone) as any;
      if (existingAdult) {
        return NextResponse.json({
          success: false,
          error: `Já existe um membro titular cadastrado com este WhatsApp (${existingAdult.name}). Se este cadastro for para uma criança/dependente, selecione a opção de criança.`
        }, { status: 400 });
      }
    }

    const id = "m_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

    let effectiveIsLeader = 0;
    let leaderStatus = "none";
    let leaderNominatedBy = "";

    const hasLeaderDepts = Array.isArray(leader_department_ids) && leader_department_ids.length > 0;

    // Crianças não assumem cargos de liderança
    if (!isChild && (is_leader || hasLeaderDepts)) {
      if (auth.isGeneralAdmin) {
        effectiveIsLeader = 1;
        leaderStatus = "approved";
      } else {
        effectiveIsLeader = 0;
        leaderStatus = "pending";
        leaderNominatedBy = auth.userName;
      }
    }

    const insertMember = db.prepare(`
      INSERT INTO members (id, name, phone, email, is_active, is_leader, leader_status, leader_nominated_by, is_child, parent_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertMember.run(
      id,
      name.trim(),
      cleanPhone,
      email || "",
      is_active ? 1 : 0,
      effectiveIsLeader,
      leaderStatus,
      leaderNominatedBy,
      isChild ? 1 : 0,
      effectiveParentId
    );

    // Insert roles
    if (Array.isArray(role_ids) && role_ids.length > 0) {
      const insertMR = db.prepare("INSERT INTO member_roles (member_id, role_id) VALUES (?, ?)");
      for (const rId of role_ids) {
        insertMR.run(id, rId);
      }
    }

    // Insert departments
    if (Array.isArray(department_ids) && department_ids.length > 0) {
      const insertMD = db.prepare("INSERT INTO member_departments (member_id, department_id, is_department_leader) VALUES (?, ?, ?)");
      for (const dId of department_ids) {
        const isDeptLeader = (!isChild) && (
          (Array.isArray(leader_department_ids) && leader_department_ids.includes(dId)) ||
          (effectiveIsLeader === 1 && (!leader_department_ids || leader_department_ids.length === 0))
        ) ? 1 : 0;
        insertMD.run(id, dId, isDeptLeader);
      }
    }

    const message = isChild
      ? `Criança cadastrada com sucesso vinculada ao telefone do responsável!`
      : leaderStatus === "pending"
      ? `Membro cadastrado com sucesso! A indicação para líder foi enviada e aguarda aprovação do Administrador.`
      : `Membro cadastrado com sucesso!`;

    return NextResponse.json({ 
      success: true, 
      message, 
      data: { id, name: name.trim(), phone: cleanPhone, is_child: isChild, parent_id: effectiveParentId, leader_status: leaderStatus } 
    });
  } catch (error: any) {
    if (error.message.includes("idx_members_phone_adults") || error.message.includes("UNIQUE constraint failed")) {
      return NextResponse.json({ success: false, error: "Já existe um membro titular cadastrado com este número de WhatsApp." }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, name, phone, email, is_active, is_leader, is_child, parent_id, role_ids, department_ids, leader_department_ids, user_id, user_phone, pin, action } = body;

    const auth = await getLeaderAuthDetails({ user_id, user_phone, pin });
    // Apenas líder / responsável autenticado pode alterar dados de membros
    if (!auth.isAuthorized) {
      return NextResponse.json({
        success: false,
        error: "Acesso restrito: Somente um líder ou responsável autenticado pode alterar dados de membros."
      }, { status: 403 });
    }

    // O Administrador poderá definir qualquer membro para líder de qualquer departamento diretamente sem confirmação
    if (action === "set_leader") {
      if (!auth.isGeneralAdmin && !auth.isAuthorized) {
        return NextResponse.json({ success: false, error: "Apenas o Administrador ou liderança superior pode definir líderes." }, { status: 403 });
      }

      const targetDeptId = body.department_id;
      const targetLeaderDeptIds = body.leader_department_ids;

      db.prepare(`
        UPDATE members
        SET is_leader = 1, leader_status = 'approved', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(id);

      if (Array.isArray(targetLeaderDeptIds) && targetLeaderDeptIds.length > 0) {
        for (const dId of targetLeaderDeptIds) {
          const exists = db.prepare("SELECT * FROM member_departments WHERE member_id = ? AND department_id = ?").get(id, dId);
          if (exists) {
            db.prepare("UPDATE member_departments SET is_department_leader = 1 WHERE member_id = ? AND department_id = ?").run(id, dId);
          } else {
            db.prepare("INSERT INTO member_departments (member_id, department_id, is_department_leader) VALUES (?, ?, 1)").run(id, dId);
          }
        }
      } else if (targetDeptId) {
        const exists = db.prepare("SELECT * FROM member_departments WHERE member_id = ? AND department_id = ?").get(id, targetDeptId);
        if (exists) {
          db.prepare("UPDATE member_departments SET is_department_leader = 1 WHERE member_id = ? AND department_id = ?").run(id, targetDeptId);
        } else {
          db.prepare("INSERT INTO member_departments (member_id, department_id, is_department_leader) VALUES (?, ?, 1)").run(id, targetDeptId);
        }
      } else {
        db.prepare("UPDATE member_departments SET is_department_leader = 1 WHERE member_id = ?").run(id);
      }

      return NextResponse.json({ success: true, message: "Membro definido como líder com sucesso e sem restrições!" });
    }

    if (action === "demote_leader") {
      if (!auth.isGeneralAdmin && !auth.isAuthorized) {
        return NextResponse.json({ success: false, error: "Apenas o Administrador pode alterar perfis." }, { status: 403 });
      }
      db.prepare(`
        UPDATE members
        SET is_leader = 0, leader_status = 'none', leader_nominated_by = '', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(id);

      db.prepare("UPDATE member_departments SET is_department_leader = 0 WHERE member_id = ?").run(id);

      return NextResponse.json({ success: true, message: "Perfil do membro alterado para voluntário." });
    }

    // Toggle de liderança de departamento específico para o Administrador sem confirmação
    if (action === "toggle_dept_leader") {
      if (!auth.isGeneralAdmin && !auth.isAuthorized) {
        return NextResponse.json({ success: false, error: "Apenas o Administrador pode definir liderança de departamentos." }, { status: 403 });
      }
      const targetDeptId = body.department_id;
      if (!targetDeptId) {
        return NextResponse.json({ success: false, error: "Departamento não informado." }, { status: 400 });
      }

      const currentRel = db.prepare("SELECT * FROM member_departments WHERE member_id = ? AND department_id = ?").get(id, targetDeptId) as any;
      const willBeLeader = currentRel && currentRel.is_department_leader === 1 ? 0 : 1;

      if (currentRel) {
        db.prepare("UPDATE member_departments SET is_department_leader = ? WHERE member_id = ? AND department_id = ?").run(willBeLeader, id, targetDeptId);
      } else {
        db.prepare("INSERT INTO member_departments (member_id, department_id, is_department_leader) VALUES (?, ?, ?)").run(id, targetDeptId, willBeLeader);
      }

      // Atualiza o status geral do membro com base na liderança dos departamentos
      const count = db.prepare("SELECT COUNT(*) as c FROM member_departments WHERE member_id = ? AND is_department_leader = 1").get(id) as { c: number };
      if (count.c > 0) {
        db.prepare("UPDATE members SET is_leader = 1, leader_status = 'approved', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
      } else {
        db.prepare("UPDATE members SET is_leader = 0, leader_status = 'none', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
      }

      return NextResponse.json({
        success: true,
        message: willBeLeader === 1 ? "Membro definido como líder do departamento!" : "Liderança do departamento removida.",
        is_dept_leader: willBeLeader === 1
      });
    }

    // Ações de aprovação / recusa de indicação de líder
    if (action === "approve_leader") {
      if (!auth.isGeneralAdmin && !auth.isAuthorized) {
        return NextResponse.json({ success: false, error: "Apenas um administrador ou líder superior pode aprovar liderança." }, { status: 403 });
      }
      db.prepare(`
        UPDATE members
        SET is_leader = 1, leader_status = 'approved', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(id);

      db.prepare("UPDATE member_departments SET is_department_leader = 1 WHERE member_id = ?").run(id);

      return NextResponse.json({ success: true, message: "Indicação de líder aprovada com sucesso! O membro agora é líder oficial." });
    }

    if (action === "reject_leader") {
      db.prepare(`
        UPDATE members
        SET is_leader = 0, leader_status = 'none', leader_nominated_by = '', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(id);

      return NextResponse.json({ success: true, message: "Indicação de líder recusada." });
    }

    const currentMember = db.prepare("SELECT * FROM members WHERE id = ?").get(id) as any;
    if (!currentMember) {
      return NextResponse.json({ success: false, error: "Membro não encontrado." }, { status: 404 });
    }

    const isChild = is_child !== undefined ? Boolean(is_child) : Boolean(currentMember.is_child);
    let cleanPhone = (phone || currentMember.phone || "").replace(/\D/g, "");
    let effectiveParentId: string | null = currentMember.parent_id;

    if (isChild) {
      const targetParentId = parent_id || currentMember.parent_id;
      if (!targetParentId) {
        return NextResponse.json({ success: false, error: "Selecione o responsável cadastrado para esta criança." }, { status: 400 });
      }
      const parent = db.prepare("SELECT * FROM members WHERE id = ?").get(targetParentId) as any;
      if (!parent) {
        return NextResponse.json({ success: false, error: "Responsável selecionado não encontrado." }, { status: 404 });
      }
      cleanPhone = parent.phone;
      effectiveParentId = parent.id;
    } else {
      effectiveParentId = null;
      if (cleanPhone) {
        const existingAdult = db.prepare("SELECT * FROM members WHERE phone = ? AND id != ? AND (is_child = 0 OR is_child IS NULL)").get(cleanPhone, id) as any;
        if (existingAdult) {
          return NextResponse.json({
            success: false,
            error: `Já existe outro membro titular cadastrado com este WhatsApp (${existingAdult.name}).`
          }, { status: 400 });
        }
      }
    }

    // Regra de Liderança na Edição
    let effectiveIsLeader = currentMember.is_leader;
    let leaderStatus = currentMember.leader_status || "none";
    let leaderNominatedBy = currentMember.leader_nominated_by || "";

    const hasLeaderDepts = Array.isArray(leader_department_ids) && leader_department_ids.length > 0;

    if (isChild) {
      effectiveIsLeader = 0;
      leaderStatus = "none";
      leaderNominatedBy = "";
    } else if (is_leader !== undefined || hasLeaderDepts) {
      if (is_leader || hasLeaderDepts) {
        if (auth.isGeneralAdmin) {
          effectiveIsLeader = 1;
          leaderStatus = "approved";
        } else if (currentMember.is_leader === 1 && currentMember.leader_status === "approved") {
          // Já era líder aprovado anteriormente
          effectiveIsLeader = 1;
          leaderStatus = "approved";
        } else {
          // Indicado por líder comum -> pendente
          effectiveIsLeader = 0;
          leaderStatus = "pending";
          leaderNominatedBy = auth.userName;
        }
      } else {
        effectiveIsLeader = 0;
        leaderStatus = "none";
        leaderNominatedBy = "";
      }
    }

    db.prepare(`
      UPDATE members
      SET name = ?, phone = ?, email = ?, is_active = ?, is_leader = ?, leader_status = ?, leader_nominated_by = ?, is_child = ?, parent_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, cleanPhone, email || "", is_active ? 1 : 0, effectiveIsLeader, leaderStatus, leaderNominatedBy, isChild ? 1 : 0, effectiveParentId, id);

    // Se for um adulto e alterou seu telefone, sincronizar o telefone de suas crianças cadastradas
    if (!isChild && cleanPhone) {
      db.prepare("UPDATE members SET phone = ? WHERE parent_id = ? AND is_child = 1").run(cleanPhone, id);
    }

    // Update roles
    db.prepare("DELETE FROM member_roles WHERE member_id = ?").run(id);
    if (Array.isArray(role_ids)) {
      const insertMR = db.prepare("INSERT INTO member_roles (member_id, role_id) VALUES (?, ?)");
      for (const rId of role_ids) {
        insertMR.run(id, rId);
      }
    }

    // Update departments
    db.prepare("DELETE FROM member_departments WHERE member_id = ?").run(id);
    if (Array.isArray(department_ids)) {
      const insertMD = db.prepare("INSERT INTO member_departments (member_id, department_id, is_department_leader) VALUES (?, ?, ?)");
      for (const dId of department_ids) {
        const isDeptLeader = (Array.isArray(leader_department_ids) && leader_department_ids.includes(dId)) ||
          (effectiveIsLeader === 1 && (!leader_department_ids || leader_department_ids.length === 0)) ? 1 : 0;
        insertMD.run(id, dId, isDeptLeader);
      }
    }

    const message = leaderStatus === "pending"
      ? "Membro atualizado. A indicação para líder foi registrada e aguarda aprovação do Administrador."
      : "Membro atualizado com sucesso";

    return NextResponse.json({ success: true, message });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const user_id = searchParams.get("user_id") || "";
    const user_phone = searchParams.get("user_phone") || "";
    const pin = searchParams.get("pin") || "";

    if (!id) {
      return NextResponse.json({ success: false, error: "ID não fornecido" }, { status: 400 });
    }

    const auth = await getLeaderAuthDetails({ user_id, user_phone, pin });
    // Apenas líder / responsável autenticado pode remover membros
    if (!auth.isAuthorized) {
      return NextResponse.json({
        success: false,
        error: "Acesso restrito: Somente um líder ou responsável autenticado pode remover membros."
      }, { status: 403 });
    }

    db.prepare("DELETE FROM members WHERE id = ?").run(id);
    return NextResponse.json({ success: true, message: "Membro removido com sucesso" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
