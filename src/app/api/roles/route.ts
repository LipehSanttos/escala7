import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET() {
  try {
    const roles = db.prepare(`
      SELECT r.*, d.name as department_name, d.color as department_color
      FROM roles r
      JOIN departments d ON r.department_id = d.id
      ORDER BY d.name ASC, r.name ASC
    `).all();

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
