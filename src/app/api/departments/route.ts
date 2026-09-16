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
      const deptsWithRoles = (depts || []).map((dept: any) => ({
        ...dept,
        roles: allRoles.filter((r: any) => r.department_id === dept.id)
      }));

      return NextResponse.json({ success: true, data: deptsWithRoles });
    }

    const departments = db.prepare("SELECT * FROM departments ORDER BY name ASC").all();
    const roles = db.prepare("SELECT * FROM roles ORDER BY name ASC").all();

    const deptsWithRoles = departments.map((dept: any) => ({
      ...dept,
      roles: roles.filter((r: any) => r.department_id === dept.id)
    }));

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
