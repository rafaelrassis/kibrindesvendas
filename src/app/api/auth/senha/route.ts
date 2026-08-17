import { NextRequest, NextResponse } from "next/server";
import { usuarioIdDaSessao } from "@/lib/session";
import { trocarSenha } from "@/lib/data/usuarios";
import { corpoJson, respostaDeErro } from "@/lib/api";

export async function PATCH(req: NextRequest) {
  const id = await usuarioIdDaSessao();
  if (!id) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  let senhaAtual: string | undefined;
  let novaSenha: string | undefined;
  try {
    ({ senhaAtual, novaSenha } = await corpoJson<{
      senhaAtual?: string;
      novaSenha?: string;
    }>(req));
  } catch (e) {
    return respostaDeErro(e);
  }

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
