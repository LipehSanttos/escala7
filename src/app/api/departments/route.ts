import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET() {
  try {
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
