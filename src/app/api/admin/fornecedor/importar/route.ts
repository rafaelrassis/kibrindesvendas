import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { bloqueioAdmin } from "@/lib/admin";
import { corpoJson, respostaDeErro } from "@/lib/api";
import {
  importarProdutoDoFornecedor,
  listarNovosDoFornecedor,
} from "@/lib/data/importar-fornecedor";

export const maxDuration = 60;

// Lista os produtos do site do fornecedor que ainda não existem aqui.
export async function GET(req: NextRequest) {
  const bloqueio = await bloqueioAdmin();
  if (bloqueio) return bloqueio;
  try {
    return NextResponse.json(
      await listarNovosDoFornecedor(req.nextUrl.searchParams.get("site") ?? "")
    );
  } catch (e) {
    return respostaDeErro(e);
  }
}

// Importa UM produto por chamada (a tela chama em sequência, pra caber no
// tempo da função serverless).
export async function POST(req: NextRequest) {
  const bloqueio = await bloqueioAdmin();
  if (bloqueio) return bloqueio;
  try {
    const { url, categoriaSlug, margemPct } = await corpoJson<{
      url?: string;
      categoriaSlug?: string;
      margemPct?: number;
    }>(req);
    const r = await importarProdutoDoFornecedor(url ?? "", categoriaSlug ?? "", Number(margemPct ?? 0));
    revalidatePath("/");
    revalidatePath(`/categoria/${r.categoria}`);
    return NextResponse.json({ ok: true, id: r.id, nome: r.nome });
  } catch (e) {
    return respostaDeErro(e);
  }
}
