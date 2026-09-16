import { NextResponse } from "next/server";
import { getSupabase, getServiceRoleClient } from "@/lib/supabase";
import db from "@/lib/db";

export async function GET() {
  try {
    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase
        .from("roles")
        .select("*, departments(name, color)")
        .order("name", { ascending: true });

      if (error) throw error;

      const formatted = (data || [])
        .filter((r: any) => {
          if (r.department_id === "recepcao") {
            return r.name?.toLowerCase() === "recepção" || r.id === "role_recepcao" || r.id === "recepcao_padrao";
          }
          return true;
        })
        .map((r: any) => ({
          ...r,
          name: r.department_id === "recepcao" ? "Recepção" : r.name,
          department_name: r.departments?.name || "",
          department_color: r.departments?.color || "#002F6C"
        }));

      return NextResponse.json({ success: true, data: formatted });
    }

    const allDbRoles = db.prepare(`
      SELECT r.*, d.name as department_name, d.color as department_color
      FROM roles r
      JOIN departments d ON r.department_id = d.id
      ORDER BY d.name ASC, r.name ASC
    `).all() as any[];

    const roles = allDbRoles
      .filter((r: any) => {
        if (r.department_id === "recepcao") {
          return r.name?.toLowerCase() === "recepção" || r.id === "role_recepcao" || r.id === "recepcao_padrao";
        }
        return true;
      })
      .map((r: any) => ({
        ...r,
        name: r.department_id === "recepcao" ? "Recepção" : r.name
      }));

    return NextResponse.json({ success: true, data: roles });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { department_id, name, description } = body;

    const id = `${department_id}_${name.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 20)}_${Date.now().toString().slice(-4)}`;

    const supabase = getServiceRoleClient() || getSupabase();
    if (supabase) {
      const { data, error } = await supabase
        .from("roles")
        .insert({
          id,
          department_id,
          name,
          description: description || ""
        })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

    db.prepare(`
      INSERT INTO roles (id, department_id, name, description)
      VALUES (?, ?, ?, ?)
    `).run(id, department_id, name, description || "");

    const created = db.prepare("SELECT * FROM roles WHERE id = ?").get(id);
    return NextResponse.json({ success: true, data: created });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
