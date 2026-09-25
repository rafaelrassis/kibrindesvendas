import { NextRequest, NextResponse } from "next/server";
import { bloqueioAdmin } from "@/lib/admin";
import { corpoJson, respostaDeErro } from "@/lib/api";
import { darCientePrecoFornecedor, getAlertasFornecedor } from "@/lib/data/sync-fornecedor";
import { ErroDeNegocio } from "@/lib/data/erros";

export async function GET() {
  const bloqueio = await bloqueioAdmin();
  if (bloqueio) return bloqueio;

  return NextResponse.json(await getAlertasFornecedor());
}

// "Ciente" no alerta de mudança de preço. Erro de link não tem ciente: some
// sozinho quando a próxima leitura der certo (ou o link for corrigido).
export async function POST(req: NextRequest) {
  const bloqueio = await bloqueioAdmin();
  if (bloqueio) return bloqueio;

  try {
    const { produtoId } = await corpoJson<{ produtoId?: string }>(req);
    if (!produtoId) throw new ErroDeNegocio("Informe o produto.");
    await darCientePrecoFornecedor(produtoId);
    return NextResponse.json(await getAlertasFornecedor());
  } catch (e) {
    return respostaDeErro(e);
  }
}
