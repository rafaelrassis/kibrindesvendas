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
    const { codigo, valorPedido, produtoId, itens } = await corpoJson<{
      codigo: string;
      valorPedido: number;
      produtoId?: string;
      // Carrinho com vários produtos: valor de cada linha (preço × quantidade).
      itens?: { produtoId: string; valor: number }[];
    }>(req);
    // Preview só: o servidor recalcula tudo na hora de gravar o pedido, então
    // aqui basta descartar o que não tem cara de linha válida.
    const linhas = Array.isArray(itens)
      ? itens
          .filter((i) => i && typeof i.produtoId === "string" && Number.isFinite(Number(i.valor)))
          .slice(0, 30)
          .map((i) => ({ produtoId: i.produtoId, valor: Number(i.valor) }))
      : undefined;
    const { desconto, freteGratis } = await validarCupom(codigo, Number(valorPedido) || 0, {
      usuarioId,
      produtoId,
      itens: linhas,
    });
    return NextResponse.json({ valido: true, desconto, freteGratis });
  } catch (e) {
    return respostaDeErro(e);
  }
}
