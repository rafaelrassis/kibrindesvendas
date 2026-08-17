import { NextRequest, NextResponse } from "next/server";
import { usuarioIdDaSessao } from "@/lib/session";
import { trocarSenha } from "@/lib/data/usuarios";

export async function PATCH(req: NextRequest) {
  const id = await usuarioIdDaSessao();
  if (!id) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { senhaAtual, novaSenha } = await req.json();
  if (!senhaAtual || !novaSenha || novaSenha.length < 6) {
    return NextResponse.json(
      { error: "Preencha a senha atual e uma nova senha com pelo menos 6 caracteres." },
      { status: 400 }
    );
  }

  try {
    await trocarSenha(id, senhaAtual, novaSenha);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Não foi possível trocar a senha." },
      { status: 400 }
    );
  }
}
