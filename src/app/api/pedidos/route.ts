import { NextRequest, NextResponse } from "next/server";
import { criarPedido } from "@/lib/data/pedidos";
import { usuarioIdDaSessao } from "@/lib/session";
import { respostaDeErro } from "@/lib/admin";

export async function POST(req: NextRequest) {
  const usuarioId = await usuarioIdDaSessao();
  if (!usuarioId) {
    return NextResponse.json(
      { error: "É preciso estar logado pra finalizar o pedido." },
      { status: 401 }
    );
  }

  try {
    const { pedido, checkoutUrl } = await criarPedido(usuarioId, await req.json());
    return NextResponse.json({ id: pedido.id, checkoutUrl });
  } catch (e) {
    return respostaDeErro(e);
  }
}
