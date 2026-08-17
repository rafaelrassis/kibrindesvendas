import { NextRequest, NextResponse } from "next/server";
import { criarPedido } from "@/lib/data/pedidos";
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
    const pedido = await criarPedido(usuarioId, await corpoJson(req));
    return NextResponse.json({ id: pedido.id });
  } catch (e) {
    return respostaDeErro(e);
  }
}
