import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date"); // YYYY-MM-DD

    let query = `
      SELECT 
        si.id as item_id,
        si.date,
        si.service_type,
        r.name as role_name,
        d.id as department_id,
        d.name as department_name,
        d.color as department_color,
        s.id as schedule_id,
        s.title as schedule_title,
        m.id as member_id,
        m.name as member_name,
        m.phone as member_phone
      FROM schedule_items si
      JOIN schedules s ON si.schedule_id = s.id
      JOIN departments d ON s.department_id = d.id
      JOIN roles r ON si.role_id = r.id
      JOIN members m ON si.member_id = m.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (date) {
      query += ` AND si.date = ?`;
      params.push(date);
    }

    query += ` ORDER BY si.date ASC, d.name ASC, r.name ASC`;

    const reminders = db.prepare(query).all(...params);
    return NextResponse.json({ success: true, data: reminders });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}