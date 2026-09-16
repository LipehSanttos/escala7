import { NextResponse } from "next/server";
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

    const member = db.prepare("SELECT * FROM members WHERE id = ?").get(user_id) as any;
    if (!member) {
      return NextResponse.json(
        { success: false, error: "Membro não encontrado." },
        { status: 404 }
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

    // Validação da senha atual:
    // Se o membro já possuir senha customizada, confere com member.password
    // Se ainda não tiver senha customizada, a senha atual deve ser o próprio telefone
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

    // Atualiza a nova senha
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
