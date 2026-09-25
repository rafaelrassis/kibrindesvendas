import { NextRequest, NextResponse } from "next/server";
import { bloqueioAdmin } from "@/lib/admin";
import { corpoJson, respostaDeErro } from "@/lib/api";
import { processarLote, sincronizarProdutoAgora } from "@/lib/data/sync-fornecedor";
import { ErroDeNegocio } from "@/lib/data/erros";
import { revalidarProdutos } from "@/lib/revalidar-produtos";

export const maxDuration = 60;

// Sincronização manual. `{ produtoId }` sincroniza um produto só;
// `{ desde }` (ISO do clique em "Sincronizar tudo") processa um lote de quem
// ainda não foi verificado desde então — a tela chama de novo enquanto
// `pendentes` > 0.
export async function POST(req: NextRequest) {
  const bloqueio = await bloqueioAdmin();
  if (bloqueio) return bloqueio;

  try {
    const corpo = await corpoJson<{ produtoId?: string; desde?: string }>(req);
    if (corpo.produtoId) {
      const r = await sincronizarProdutoAgora(corpo.produtoId);
      revalidarProdutos([r]);
      return NextResponse.json(r);
    }
    const desde = corpo.desde ? new Date(corpo.desde) : null;
    if (!desde || Number.isNaN(desde.getTime()) || desde > new Date()) {
      throw new ErroDeNegocio("Informe o produto ou o início da sincronização.");
    }
    const { resultados, pendentes } = await processarLote(desde, 40_000);
    revalidarProdutos(resultados);
    return NextResponse.json({ resultados, pendentes });
  } catch (e) {
    return respostaDeErro(e);
  }
}
