import { NextRequest, NextResponse } from "next/server";
import { criarPedido, getPedidosDoUsuario } from "@/lib/data/pedidos";
import type { ItemCarrinho } from "@/lib/cart-context";
import { usuarioIdDaSessao } from "@/lib/session";
import { corpoJson, respostaDeErro } from "@/lib/api";

// Visitante sem conta não tem pedido: lista vazia, sem erro — quem convida a
// entrar é a tela.
export async function GET() {
  const usuarioId = await usuarioIdDaSessao();
  if (!usuarioId) return NextResponse.json([]);

  return NextResponse.json(await getPedidosDoUsuario(usuarioId));
}

export async function POST(req: NextRequest) {
  const usuarioId = await usuarioIdDaSessao();
  if (!usuarioId) {
    return NextResponse.json(
      { error: "É preciso estar logado pra finalizar o pedido." },
      { status: 401 }
    );
  }

  try {
    const { item, cep } = await corpoJson<{ item: ItemCarrinho; cep: string }>(req);
    const { pedido, checkoutUrl } = await criarPedido(usuarioId, item, cep);
    return NextResponse.json({ id: pedido.id, checkoutUrl });
  } catch (e) {
    return respostaDeErro(e);
  }
}
