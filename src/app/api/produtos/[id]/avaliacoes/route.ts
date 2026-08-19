import { NextRequest, NextResponse } from "next/server";
import {
  criarOuAtualizarAvaliacao,
  getAvaliacoesAprovadas,
  getMinhaAvaliacao,
  getResumoAvaliacoes,
} from "@/lib/data/avaliacoes";
import { usuarioIdDaSessao } from "@/lib/session";
import { corpoJson, respostaDeErro } from "@/lib/api";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuarioId = await usuarioIdDaSessao();

  const [avaliacoes, resumo, minha] = await Promise.all([
    getAvaliacoesAprovadas(id),
    getResumoAvaliacoes(id),
    usuarioId ? getMinhaAvaliacao(usuarioId, id) : null,
  ]);

  return NextResponse.json({
    avaliacoes,
    resumo,
    // A tela usa isso pra mostrar "sua avaliação está em análise" em vez do
    // formulário de novo, sem precisar de outra chamada.
    minhaAvaliacaoPendente: minha ? !minha.aprovado : false,
    jaAvaliei: !!minha,
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuarioId = await usuarioIdDaSessao();
  if (!usuarioId) {
    return NextResponse.json({ error: "É preciso estar logado pra avaliar." }, { status: 401 });
  }

  const { id } = await params;

  try {
    const { nota, comentario } = await corpoJson<{ nota?: unknown; comentario?: unknown }>(req);
    await criarOuAtualizarAvaliacao(usuarioId, id, nota, comentario);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}
