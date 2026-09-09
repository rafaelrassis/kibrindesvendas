import { NextRequest, NextResponse } from "next/server";
import { validarCupom } from "@/lib/data/cupons";
import { usuarioIdDaSessao } from "@/lib/session";
import { corpoJson, respostaDeErro } from "@/lib/api";

// Só uma pré-visualização pro cliente ver o desconto antes de pagar — o
// servidor confere tudo de novo, sem confiar nesse resultado, na hora de
// gravar o pedido (ver criarPedido). Exige login porque cupom de primeira
// compra depende de saber quem está comprando — sem isso não dá nem pra
// tentar validar esse tipo de cupom, e o checkout em si já exige login antes
// de chegar aqui de qualquer jeito.
export async function POST(req: NextRequest) {
  const usuarioId = await usuarioIdDaSessao();
  if (!usuarioId) {
    return NextResponse.json(
      { error: "É preciso estar logado para aplicar um cupom." },
      { status: 401 }
    );
  }

  try {
    const { codigo, valorPedido, produtoId } = await corpoJson<{
      codigo: string;
      valorPedido: number;
      produtoId?: string;
    }>(req);
    const { desconto, freteGratis } = await validarCupom(codigo, Number(valorPedido) || 0, {
      usuarioId,
      produtoId,
    });
    return NextResponse.json({ valido: true, desconto, freteGratis });
  } catch (e) {
    return respostaDeErro(e);
  }
}
