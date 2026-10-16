import { NextResponse } from "next/server";
import {
  recuperarCarrinhoVisitante,
  removerCarrinhoVisitante,
} from "@/lib/data/carrinho-visitante";
import { respostaDeErro } from "@/lib/api";

// O token (só enviado por e-mail) é a credencial: quem tem o link recupera ou
// apaga o carrinho.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    return NextResponse.json(await recuperarCarrinhoVisitante(token));
  } catch (e) {
    return respostaDeErro(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  await removerCarrinhoVisitante(token);
  return NextResponse.json({ ok: true });
}
