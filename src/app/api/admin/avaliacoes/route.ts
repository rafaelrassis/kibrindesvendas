import { NextRequest, NextResponse } from "next/server";
import { criarAvaliacaoAdmin, getAvaliacoesAdmin } from "@/lib/data/avaliacoes";
import { bloqueioAdmin } from "@/lib/admin";
import { corpoJson, respostaDeErro } from "@/lib/api";

export async function GET() {
  const bloqueio = await bloqueioAdmin();
  if (bloqueio) return bloqueio;

  return NextResponse.json(await getAvaliacoesAdmin());
}

// Cria uma avaliação em nome da loja (sem cliente real por trás — ex.: review
// que chegou por WhatsApp e a loja quer publicar). Já nasce aprovada.
export async function POST(req: NextRequest) {
  const bloqueio = await bloqueioAdmin();
  if (bloqueio) return bloqueio;

  try {
    const { produtoId, nota, comentario, autorNome } = await corpoJson<{
      produtoId?: unknown;
      nota?: unknown;
      comentario?: unknown;
      autorNome?: unknown;
    }>(req);
    if (typeof produtoId !== "string" || !produtoId) {
      return NextResponse.json({ error: "Selecione um produto." }, { status: 400 });
    }
    const avaliacao = await criarAvaliacaoAdmin(produtoId, nota, comentario, autorNome);
    return NextResponse.json(avaliacao, { status: 201 });
  } catch (e) {
    return respostaDeErro(e);
  }
}
