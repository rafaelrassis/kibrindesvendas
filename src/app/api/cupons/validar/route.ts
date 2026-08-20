import { NextRequest, NextResponse } from "next/server";
import { validarCupom } from "@/lib/data/cupons";
import { corpoJson, respostaDeErro } from "@/lib/api";

// Só uma pré-visualização pro cliente ver o desconto antes de pagar — o
// servidor confere tudo de novo, sem confiar nesse resultado, na hora de
// gravar o pedido (ver criarPedido).
export async function POST(req: NextRequest) {
  try {
    const { codigo, valorPedido } = await corpoJson<{ codigo: string; valorPedido: number }>(req);
    const { desconto, freteGratis } = await validarCupom(codigo, Number(valorPedido) || 0);
    return NextResponse.json({ valido: true, desconto, freteGratis });
  } catch (e) {
    return respostaDeErro(e);
  }
}
