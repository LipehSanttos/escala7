import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import db from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let requestedDate = searchParams.get("date") || "";

    const supabase = getSupabase();

    // 1. Fluxo via Supabase (Cloudflare / Produção)
    if (supabase) {
      // Buscar lista completa de departamentos para mapeamento sem falhas
      const [{ data: allDepts }, { data: allItems, error: itemsErr }] = await Promise.all([
        supabase.from("departments").select("*"),
        supabase
          .from("schedule_items")
          .select(`
            id,
            date,
            service_type,
            role_id,
            member_id,
            notes,
            roles(id, name, department_id),
            members(id, name, phone, is_active),
            schedules!inner(id, status, department_id)
          `)
          .eq("schedules.status", "published")
          .order("date", { ascending: true })
      ]);

      if (itemsErr) throw itemsErr;

      const deptMap = new Map<string, { id: string; name: string; color: string; icon: string }>(
        (allDepts || []).map(d => [d.id, d])
      );

      const rawItems = allItems || [];
      const distinctDatesMap = new Map<string, { date: string; service_type: string; count: number }>();

      for (const item of rawItems) {
        if (!item.date) continue;
        const current = distinctDatesMap.get(item.date) || {
          date: item.date,
          service_type: item.service_type || "Culto",
          count: 0
        };
        current.count += 1;
        distinctDatesMap.set(item.date, current);
      }

      const availableDates = Array.from(distinctDatesMap.values()).sort((a, b) => a.date.localeCompare(b.date));

      if (!requestedDate && availableDates.length > 0) {
        const todayStr = new Date().toISOString().split("T")[0];
        const exactToday = availableDates.find(d => d.date === todayStr);
        const upcoming = availableDates.find(d => d.date >= todayStr);
        requestedDate = exactToday?.date || upcoming?.date || availableDates[0].date;
      }

      const dayItems = rawItems.filter(i => i.date === requestedDate);

      const deptsMap = new Map<string, {
        id: string;
        name: string;
        color: string;
        icon: string;
        items: { role_name: string; member_name: string; notes?: string }[];
      }>();

      let detectedServiceType = "";

      for (const it of dayItems) {
        if (!detectedServiceType && it.service_type) detectedServiceType = it.service_type;

        const role = (it as any).roles;
        const schedule = (it as any).schedules;
        const deptId = role?.department_id || schedule?.department_id || "diaconato";
        const deptInfo = deptMap.get(deptId);

        const deptName = deptInfo?.name || (deptId === "sonoplastia" ? "Sonoplastia e Mídia" : deptId === "diaconato" ? "Diaconato" : deptId);
        const deptColor = deptInfo?.color || "#002F6C";
        const deptIcon = deptInfo?.icon || "Calendar";

        if (!deptsMap.has(deptId)) {
          deptsMap.set(deptId, {
            id: deptId,
            name: deptName,
            color: deptColor,
            icon: deptIcon,
            items: []
          });
        }

        const member = (it as any).members;
        deptsMap.get(deptId)!.items.push({
          role_name: role?.name || "Função",
          member_name: member?.name || "A definir",
          notes: it.notes || ""
        });
      }

      return NextResponse.json({
        success: true,
        data: {
          date: requestedDate,
          service_type: detectedServiceType || "Culto",
          departments: Array.from(deptsMap.values())
        },
        available_dates: availableDates
      });
    }

    // 2. Fluxo via SQLite Local (Desenvolvimento offline)
    const availableDates = db.prepare(`
      SELECT si.date, si.service_type, COUNT(*) as count
      FROM schedule_items si
      JOIN schedules s ON si.schedule_id = s.id
      WHERE s.status = 'published' AND si.member_id IS NOT NULL AND si.member_id != ''
      GROUP BY si.date, si.service_type
      ORDER BY si.date ASC
    `).all() as { date: string; service_type: string; count: number }[];

    if (!requestedDate && availableDates.length > 0) {
      const todayStr = new Date().toISOString().split("T")[0];
      const exactToday = availableDates.find(d => d.date === todayStr);
      const upcoming = availableDates.find(d => d.date >= todayStr);
      requestedDate = exactToday?.date || upcoming?.date || availableDates[0].date;
    }

    const rows = db.prepare(`
      SELECT 
        si.date, 
        si.service_type, 
        d.id as dept_id,
        d.name as dept_name, 
        d.color as dept_color,
        d.icon as dept_icon,
        r.id as role_id,
        r.name as role_name, 
        m.id as member_id,
        m.name as member_name,
        si.notes
      FROM schedule_items si 
      JOIN schedules s ON si.schedule_id = s.id 
      JOIN departments d ON s.department_id = d.id 
      JOIN roles r ON si.role_id = r.id 
      JOIN members m ON si.member_id = m.id 
      WHERE si.date = ? AND s.status = 'published'
      ORDER BY d.name ASC, r.name ASC
    `).all(requestedDate) as any[];

    let detectedServiceType = "";
    const deptsMap = new Map<string, {
      id: string;
      name: string;
      color: string;
      icon: string;
      items: { role_name: string; member_name: string; notes?: string }[];
    }>();

    for (const r of rows) {
      if (!detectedServiceType && r.service_type) detectedServiceType = r.service_type;

      if (!deptsMap.has(r.dept_id)) {
        deptsMap.set(r.dept_id, {
          id: r.dept_id,
          name: r.dept_name,
          color: r.dept_color || "#002F6C",
          icon: r.dept_icon || "Calendar",
          items: []
        });
      }

      deptsMap.get(r.dept_id)!.items.push({
        role_name: r.role_name,
        member_name: r.member_name,
        notes: r.notes || ""
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        date: requestedDate,
        service_type: detectedServiceType || (availableDates.find(d => d.date === requestedDate)?.service_type || "Culto"),
        departments: Array.from(deptsMap.values())
      },
      available_dates: availableDates
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
