import { NextRequest, NextResponse } from "next/server";
import { getCarrinho, limparCarrinho, salvarCarrinho } from "@/lib/data/carrinho";
import { usuarioIdDaSessao } from "@/lib/session";
import { corpoJson, respostaDeErro } from "@/lib/api";

// Sacola persistida é só de quem está logado: visitante segue no localStorage
// (ver cart-context.tsx), então as três rotas exigem sessão.
export async function GET() {
  const usuarioId = await usuarioIdDaSessao();
  if (!usuarioId) return NextResponse.json(null);

  return NextResponse.json(await getCarrinho(usuarioId));
}

export async function PUT(req: NextRequest) {
  const usuarioId = await usuarioIdDaSessao();
  if (!usuarioId) {
    return NextResponse.json({ error: "É preciso estar logado." }, { status: 401 });
  }

  try {
    const { item } = await corpoJson<{ item?: unknown }>(req);
    const salvo = await salvarCarrinho(usuarioId, item);
    return NextResponse.json(salvo);
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
