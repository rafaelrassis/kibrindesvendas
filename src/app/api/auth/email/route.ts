import { NextRequest, NextResponse } from "next/server";
import { usuarioIdDaSessao } from "@/lib/session";
import { trocarEmail } from "@/lib/data/usuarios";
import { corpoJson, respostaDeErro } from "@/lib/api";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function PATCH(req: NextRequest) {
  const id = await usuarioIdDaSessao();
  if (!id) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  let senhaAtual: string | undefined;
  let novoEmail: string | undefined;
  try {
    ({ senhaAtual, novoEmail } = await corpoJson<{
      senhaAtual?: string;
      novoEmail?: string;
    }>(req));
  } catch (e) {
    return respostaDeErro(e);
  }

  novoEmail = novoEmail?.trim().toLowerCase();

  if (!senhaAtual || !novoEmail || !EMAIL_RE.test(novoEmail)) {
    return NextResponse.json(
      { error: "Informe a senha atual e um e-mail válido." },
      { status: 400 }
    );
  }

  try {
    const usuario = await trocarEmail(id, senhaAtual, novoEmail);
    return NextResponse.json(usuario);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Não foi possível trocar o e-mail." },
      { status: 400 }
    );
  }
}
