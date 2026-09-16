import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { member_id, date, exclude_item_id } = body;

    if (!member_id || !date) {
      return NextResponse.json({ success: false, error: "Parâmetros incompletos" }, { status: 400 });
    }

    // Procura se o membro já está alocado em algum schedule_item nesta mesma data
    let query = `
      SELECT 
        si.id as item_id,
        si.date,
        si.service_type,
        r.name as role_name,
        d.name as department_name,
        d.color as department_color,
        s.title as schedule_title,
        m.name as member_name
      FROM schedule_items si
      JOIN schedules s ON si.schedule_id = s.id
      JOIN departments d ON s.department_id = d.id
      JOIN roles r ON si.role_id = r.id
      JOIN members m ON si.member_id = m.id
      WHERE si.member_id = ? AND si.date = ?
    `;

    const params: any[] = [member_id, date];

    if (exclude_item_id) {
      query += ` AND si.id != ?`;
      params.push(exclude_item_id);
    }

    const conflicts = db.prepare(query).all(...params);

    if (conflicts.length > 0) {
      return NextResponse.json({
        success: true,
        hasConflict: true,
        conflicts: conflicts
      });
    }

    return NextResponse.json({
      success: true,
      hasConflict: false,
      conflicts: []
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
