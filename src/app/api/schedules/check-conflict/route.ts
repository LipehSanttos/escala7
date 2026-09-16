import { NextResponse } from "next/server";
import { getSupabase, getServiceRoleClient } from "@/lib/supabase";
import db from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { member_id, date, exclude_item_id, exclude_schedule_id } = body;

    if (!member_id || !date) {
      return NextResponse.json({ success: false, error: "Parâmetros incompletos" }, { status: 400 });
    }

    const supabase = getServiceRoleClient() || getSupabase();
    if (supabase) {
      let q = supabase
        .from("schedule_items")
        .select(`
          id,
          date,
          service_type,
          schedule_id,
          roles(name),
          schedules(id, title, departments(name, color)),
          members(name)
        `)
        .eq("member_id", member_id)
        .eq("date", date);

      if (exclude_item_id) {
        q = q.neq("id", exclude_item_id);
      }
      if (exclude_schedule_id) {
        q = q.neq("schedule_id", exclude_schedule_id);
      }

      const { data, error } = await q;
      if (error) throw error;

      if (data && data.length > 0) {
        const formatted = data.map((item: any) => ({
          item_id: item.id,
          date: item.date,
          service_type: item.service_type,
          role_name: item.roles?.name || "",
          department_name: item.schedules?.departments?.name || "Outro departamento",
          department_color: item.schedules?.departments?.color || "#002F6C",
          schedule_title: item.schedules?.title || "",
          member_name: item.members?.name || ""
        }));

        return NextResponse.json({
          success: true,
          hasConflict: true,
          conflicts: formatted
        });
      }

      return NextResponse.json({
        success: true,
        hasConflict: false,
        conflicts: []
      });
    }

    // Procura se o membro já está alocado em algum schedule_item nesta mesma data no SQLite
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
    if (exclude_schedule_id) {
      query += ` AND si.schedule_id != ?`;
      params.push(exclude_schedule_id);
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

