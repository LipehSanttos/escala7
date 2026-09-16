import { NextResponse } from "next/server";
import { getSupabase, getServiceRoleClient } from "@/lib/supabase";
import db from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { user_id, current_password, new_password } = body;

    if (!user_id) {
      return NextResponse.json(
        { success: false, error: "Identificação do usuário necessária." },
        { status: 400 }
      );
    }

    const currentPass = (current_password || "").trim();
    const newPass = (new_password || "").trim();

    if (!currentPass) {
      return NextResponse.json(
        { success: false, error: "Informe a senha atual." },
        { status: 400 }
      );
    }

    if (!newPass) {
      return NextResponse.json(
        { success: false, error: "A nova senha não pode ser vazia." },
        { status: 400 }
      );
    }

    if (newPass.length < 4) {
      return NextResponse.json(
        { success: false, error: "A nova senha deve ter no mínimo 4 caracteres." },
        { status: 400 }
      );
    }

    const supabase = getServiceRoleClient() || getSupabase();
    if (supabase) {
      const { data: member, error: mErr } = await supabase
        .from("members")
        .select("*")
        .eq("id", user_id)
        .limit(1)
        .maybeSingle();

      if (mErr || !member) {
        return NextResponse.json({ success: false, error: "Membro não encontrado." }, { status: 404 });
      }

      const existingPass = member.password_hash || member.password;
      if (existingPass && String(existingPass).trim().length > 0) {
        if (currentPass !== String(existingPass).trim()) {
          return NextResponse.json({ success: false, error: "A senha atual informada está incorreta." }, { status: 400 });
        }
      } else {
        const cleanCurrent = currentPass.replace(/\D/g, "");
        const cleanPhone = (member.phone || "").replace(/\D/g, "");
        if (currentPass !== member.phone && cleanCurrent !== cleanPhone) {
          return NextResponse.json({ success: false, error: "A senha atual informada está incorreta." }, { status: 400 });
        }
      }

      const { error: updErr } = await supabase
        .from("members")
        .update({ password_hash: newPass, updated_at: new Date().toISOString() })
        .eq("id", member.id);

      if (updErr) throw updErr;

      return NextResponse.json({
        success: true,
        message: "Senha alterada com sucesso! Use sua nova senha nos próximos acessos."
      });
    }

    const member = db.prepare("SELECT * FROM members WHERE id = ?").get(user_id) as any;
    if (!member) {
      return NextResponse.json(
        { success: false, error: "Membro não encontrado." },
        { status: 404 }
      );
    }

    if (member.password && member.password.trim().length > 0) {
      if (currentPass !== member.password) {
        return NextResponse.json(
          { success: false, error: "A senha atual informada está incorreta." },
          { status: 400 }
        );
      }
    } else {
      const cleanCurrent = currentPass.replace(/\D/g, "");
      const cleanPhone = (member.phone || "").replace(/\D/g, "");
      if (currentPass !== member.phone && cleanCurrent !== cleanPhone) {
        return NextResponse.json(
          { 
            success: false, 
            error: "A senha atual informada está incorreta." 
          },
          { status: 400 }
        );
      }
    }

    db.prepare(`
      UPDATE members
      SET password = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newPass, member.id);

    return NextResponse.json({
      success: true,
      message: "Senha alterada com sucesso! Use sua nova senha nos próximos acessos."
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
