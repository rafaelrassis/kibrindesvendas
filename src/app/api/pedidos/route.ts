import { NextRequest, NextResponse } from "next/server";
import { criarPedido } from "@/lib/data/pedidos";
import type { ItemCarrinho } from "@/lib/cart-context";
import { usuarioIdDaSessao } from "@/lib/session";
import { corpoJson, respostaDeErro } from "@/lib/api";

export async function POST(req: NextRequest) {
  const usuarioId = await usuarioIdDaSessao();
  if (!usuarioId) {
    return NextResponse.json(
      { error: "É preciso estar logado pra finalizar o pedido." },
      { status: 401 }
    );
  }

  try {
    const { pedido, checkoutUrl } = await criarPedido(
      usuarioId,
      await corpoJson<ItemCarrinho>(req)
    );
    return NextResponse.json({ id: pedido.id, checkoutUrl });
  } catch (e) {
    return respostaDeErro(e);
  }
}
