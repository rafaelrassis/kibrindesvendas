import { NextRequest, NextResponse } from "next/server";
import { getCarrinho, limparCarrinho, salvarCarrinho } from "@/lib/data/carrinho";
import { usuarioIdDaSessao } from "@/lib/session";
import { corpoJson, respostaDeErro } from "@/lib/api";

// Carrinho persistido é só de quem está logado: visitante segue no
// localStorage (ver cart-context.tsx), então as três rotas exigem sessão.
export async function GET() {
  const usuarioId = await usuarioIdDaSessao();
  if (!usuarioId) return NextResponse.json([]);

  return NextResponse.json(await getCarrinho(usuarioId));
}

// Substitui o carrinho inteiro pela lista enviada.
export async function PUT(req: NextRequest) {
  const usuarioId = await usuarioIdDaSessao();
  if (!usuarioId) {
    return NextResponse.json({ error: "É preciso estar logado." }, { status: 401 });
  }

  try {
    const { itens } = await corpoJson<{ itens?: unknown }>(req);
    if (!Array.isArray(itens)) {
      return NextResponse.json({ error: "Carrinho inválido." }, { status: 400 });
    }
    return NextResponse.json(await salvarCarrinho(usuarioId, itens));
  } catch (e) {
    return respostaDeErro(e);
  }
}

export async function DELETE() {
  const usuarioId = await usuarioIdDaSessao();
  if (!usuarioId) {
    return NextResponse.json({ error: "É preciso estar logado." }, { status: 401 });
  }

  await limparCarrinho(usuarioId);
  return NextResponse.json({ ok: true });
}
