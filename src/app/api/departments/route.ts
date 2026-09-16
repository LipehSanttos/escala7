import { NextResponse } from "next/server";
import { getSupabase, getServiceRoleClient } from "@/lib/supabase";
import db from "@/lib/db";

export async function GET() {
  try {
    const supabase = getSupabase();
    if (supabase) {
      const [{ data: depts, error: dErr }, { data: roles, error: rErr }] = await Promise.all([
        supabase.from("departments").select("*").order("name", { ascending: true }),
        supabase.from("roles").select("*").order("name", { ascending: true })
      ]);

      if (dErr) throw dErr;
      const allRoles = roles || [];
      const deptsWithRoles = (depts || []).map((dept: any) => {
        let deptRoles = allRoles.filter((r: any) => r.department_id === dept.id);
        if (dept.id === "recepcao" || dept.name?.toLowerCase() === "recepção" || dept.name?.toLowerCase() === "recepcao") {
          // No departamento recepção só precisará ter uma função padrão: Recepção
          const stdRole = deptRoles.find((r: any) => r.name?.toLowerCase() === "recepção" || r.id === "role_recepcao" || r.id === "recepcao_padrao");
          if (stdRole) {
            deptRoles = [{ ...stdRole, name: "Recepção" }];
          } else if (deptRoles.length > 0) {
            deptRoles = [{ ...deptRoles[0], name: "Recepção" }];
          } else {
            deptRoles = [{
              id: "role_recepcao",
              department_id: dept.id,
              name: "Recepção",
              description: "Acolhimento e recepção aos membros e visitantes"
            }];
          }
        }
        return {
          ...dept,
          roles: deptRoles
        };
      });

      return NextResponse.json({ success: true, data: deptsWithRoles });
    }

    const departments = db.prepare("SELECT * FROM departments ORDER BY name ASC").all();
    const roles = db.prepare("SELECT * FROM roles ORDER BY name ASC").all();

    const deptsWithRoles = departments.map((dept: any) => {
      let deptRoles = roles.filter((r: any) => r.department_id === dept.id);
      if (dept.id === "recepcao" || dept.name?.toLowerCase() === "recepção" || dept.name?.toLowerCase() === "recepcao") {
        const stdRole = deptRoles.find((r: any) => r.name?.toLowerCase() === "recepção" || r.id === "role_recepcao" || r.id === "recepcao_padrao");
        if (stdRole) {
          deptRoles = [{ ...stdRole, name: "Recepção" }];
        } else if (deptRoles.length > 0) {
          deptRoles = [{ ...deptRoles[0], name: "Recepção" }];
        } else {
          deptRoles = [{
            id: "role_recepcao",
            department_id: dept.id,
            name: "Recepção",
            description: "Acolhimento e recepção aos membros e visitantes"
          }];
        }
      }
      return {
        ...dept,
        roles: deptRoles
      };
    });

    return NextResponse.json({ success: true, data: deptsWithRoles });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, color, icon } = body;

    const id = name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "_")
      .slice(0, 30);

    const supabase = getServiceRoleClient() || getSupabase();
    if (supabase) {
      const payload = {
        id,
        name,
        description: description || "",
        color: color || "#002F6C",
        icon: icon || "Users"
      };
      const { data, error } = await supabase.from("departments").upsert(payload).select().single();
      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

    db.prepare(`
      INSERT INTO departments (id, name, description, color, icon)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, name, description || "", color || "#002F6C", icon || "Users");

    const created = db.prepare("SELECT * FROM departments WHERE id = ?").get(id);
    return NextResponse.json({ success: true, data: created });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    let id = url.searchParams.get("id");
    let user_id = url.searchParams.get("user_id");
    let user_phone = url.searchParams.get("user_phone");
    let pin = url.searchParams.get("pin");

    // Permitir também leitura de dados do body em requisições DELETE com JSON
    if (!id) {
      try {
        const body = await request.json();
        if (body) {
          id = body.id || id;
          user_id = body.user_id || user_id;
          user_phone = body.user_phone || user_phone;
          pin = body.pin || pin;
        }
      } catch {
        // body pode ser vazio em requests DELETE comuns
      }
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Identificador (ID) do departamento é obrigatório." },
        { status: 400 }
      );
    }

    // Validação estrita de privilégio: Somente o perfil de Administrador tem permissão
    const rawPin = (pin || "").trim();
    const cleanPhone = (user_phone || "").replace(/\D/g, "");
    const configuredAdminPin = process.env.ADMIN_PIN?.trim();

    const isAdmin =
      (configuredAdminPin && (rawPin === configuredAdminPin || cleanPhone === configuredAdminPin || user_phone === configuredAdminPin)) ||
      user_id === "m_admin_leader";

    if (!isAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: "Acesso restrito: Somente o Administrador tem privilégio para excluir departamentos."
        },
        { status: 403 }
      );
    }

    const supabase = getServiceRoleClient() || getSupabase();
    if (supabase) {
      // 1. Verificar existência do departamento
      const { data: dept, error: findErr } = await supabase
        .from("departments")
        .select("id, name")
        .eq("id", id)
        .maybeSingle();

      if (findErr) throw findErr;
      if (!dept) {
        return NextResponse.json(
          { success: false, error: "Departamento não encontrado." },
          { status: 404 }
        );
      }

      // 2. Limpeza em cascata segura de referências
      // Membros vinculados ao departamento
      await supabase.from("member_departments").delete().eq("department_id", id);

      // Cargos e vínculos com membros
      const { data: roles } = await supabase.from("roles").select("id").eq("department_id", id);
      if (roles && roles.length > 0) {
        const roleIds = roles.map((r: any) => r.id);
        await supabase.from("member_roles").delete().in("role_id", roleIds);
        await supabase.from("roles").delete().eq("department_id", id);
      }

      // Escalas do departamento e solicitações
      const { data: schs } = await supabase.from("schedules").select("id").eq("department_id", id);
      if (schs && schs.length > 0) {
        const schIds = schs.map((s: any) => s.id);
        const { data: items } = await supabase.from("schedule_items").select("id").in("schedule_id", schIds);
        if (items && items.length > 0) {
          const itemIds = items.map((i: any) => i.id);
          await supabase.from("schedule_requests").delete().in("schedule_item_id", itemIds);
          await supabase.from("schedule_items").delete().in("schedule_id", schIds);
        }
        await supabase.from("schedules").delete().eq("department_id", id);
      }

      // 3. Excluir o departamento
      const { error: delErr } = await supabase.from("departments").delete().eq("id", id);
      if (delErr) throw delErr;

      return NextResponse.json({
        success: true,
        message: `Departamento "${dept.name}" excluído com sucesso.`
      });
    }

    // Modo local SQLite
    const dept = db.prepare("SELECT * FROM departments WHERE id = ?").get(id) as any;
    if (!dept) {
      return NextResponse.json(
        { success: false, error: "Departamento não encontrado." },
        { status: 404 }
      );
    }

    try {
      db.prepare("DELETE FROM member_departments WHERE department_id = ?").run(id);
    } catch {}
    try {
      db.prepare("DELETE FROM member_roles WHERE role_id IN (SELECT id FROM roles WHERE department_id = ?)").run(id);
    } catch {}
    try {
      db.prepare("DELETE FROM roles WHERE department_id = ?").run(id);
    } catch {}
    try {
      db.prepare("DELETE FROM schedule_requests WHERE schedule_item_id IN (SELECT id FROM schedule_items WHERE schedule_id IN (SELECT id FROM schedules WHERE department_id = ?))").run(id);
    } catch {}
    try {
      db.prepare("DELETE FROM schedule_items WHERE schedule_id IN (SELECT id FROM schedules WHERE department_id = ?)").run(id);
    } catch {}
    try {
      db.prepare("DELETE FROM schedules WHERE department_id = ?").run(id);
    } catch {}
    db.prepare("DELETE FROM departments WHERE id = ?").run(id);

    return NextResponse.json({
      success: true,
      message: `Departamento "${dept.name}" excluído com sucesso.`
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

