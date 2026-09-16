import { NextResponse } from "next/server";
import { getSupabase, getServiceRoleClient } from "@/lib/supabase";
import db from "@/lib/db";

const DEFAULT_CHURCH = {
  id: "1",
  name: "Igreja Adventista do Sétimo Dia",
  district: "Distrito Central",
  city: "Boa Vista",
  state: "RR",
  logo_url: ""
};

export async function GET() {
  try {
    const supabase = getSupabase();
    if (supabase) {
      const [{ data: churchData }, { data: leadersData }, { data: schedulesData }] = await Promise.all([
        supabase.from("churches").select("*").limit(1).maybeSingle(),
        supabase.from("members").select("name").eq("is_leader", true),
        supabase.from("schedules").select("author_name")
      ]);

      const authorSet = new Set<string>();
      (leadersData || []).forEach(l => l.name && authorSet.add(l.name));
      (schedulesData || []).forEach(s => s.author_name && authorSet.add(s.author_name));

      return NextResponse.json({
        success: true,
        data: churchData || DEFAULT_CHURCH,
        authorized_authors: Array.from(authorSet)
      });
    }

    const settings = db.prepare("SELECT * FROM church_settings LIMIT 1").get();
    const authorized = db.prepare(`
      SELECT DISTINCT name FROM members WHERE is_leader = 1
      UNION
      SELECT DISTINCT author_name as name FROM schedules WHERE author_name IS NOT NULL AND author_name != ''
    `).all() as { name: string }[];

    return NextResponse.json({ 
      success: true, 
      data: settings || DEFAULT_CHURCH,
      authorized_authors: authorized.map((a) => a.name)
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, district, city, state, user_id, user_phone, pin } = body;

    // Regra estrita: Somente o Administrador pode alterar as configurações da igreja
    const rawPin = (pin || "").trim();
    const cleanPhone = (user_phone || "").replace(/\D/g, "");

    const configuredAdminPin = process.env.ADMIN_PIN?.trim();
    const isAdmin =
      (configuredAdminPin && (rawPin === configuredAdminPin || cleanPhone === configuredAdminPin)) ||
      user_id === "m_admin_leader";

    if (!isAdmin) {
      return NextResponse.json({
        success: false,
        error: "Acesso restrito: Somente o Administrador pode alterar o nome da igreja e demais informações das configurações."
      }, { status: 403 });
    }

    const supabase = getServiceRoleClient() || getSupabase();
    if (supabase) {
      // Atualizar ou inserir na tabela churches
      const { data: existing } = await supabase.from("churches").select("id").limit(1).maybeSingle();
      let updated;
      if (existing) {
        const { data, error } = await supabase
          .from("churches")
          .update({ name, district, city, state, updated_at: new Date().toISOString() })
          .eq("id", existing.id)
          .select()
          .single();
        if (error) throw error;
        updated = data;
      } else {
        const { data, error } = await supabase
          .from("churches")
          .insert({ name, district, city, state })
          .select()
          .single();
        if (error) throw error;
        updated = data;
      }
      return NextResponse.json({ success: true, data: updated });
    }

    db.prepare(`
      UPDATE church_settings
      SET name = ?, district = ?, city = ?, state = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run(name, district, city, state);

    const updated = db.prepare("SELECT * FROM church_settings LIMIT 1").get();
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
