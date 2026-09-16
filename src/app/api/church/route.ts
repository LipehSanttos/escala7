import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET() {
  try {
    const settings = db.prepare("SELECT * FROM church_settings LIMIT 1").get();
    const authorized = db.prepare(`
      SELECT DISTINCT name FROM members WHERE is_leader = 1
      UNION
      SELECT DISTINCT author_name as name FROM schedules WHERE author_name IS NOT NULL AND author_name != ''
    `).all() as { name: string }[];

    return NextResponse.json({ 
      success: true, 
      data: settings,
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

    // Regra estrita: Somente o Administrador pode alterar o nome da igreja e demais informações das configurações
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
