import { NextRequest, NextResponse } from "next/server";
import { atualizarAvaliacaoAdmin, definirAprovacao, excluirAvaliacao } from "@/lib/data/avaliacoes";
import { bloqueioAdmin } from "@/lib/admin";
import { corpoJson, respostaDeErro } from "@/lib/api";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const bloqueio = await bloqueioAdmin();
  if (bloqueio) return bloqueio;

  const { id } = await params;

  try {
    const corpo = await corpoJson<{
      aprovado?: unknown;
      nota?: unknown;
      comentario?: unknown;
      autorNome?: unknown;
    }>(req);

    // `aprovado` continua sendo o toggle de publicar/ocultar de sempre —
    // separado da edição de conteúdo, que só mexe quando nota/comentario/
    // autorNome vêm no corpo.
    if (corpo.aprovado !== undefined) {
      await definirAprovacao(id, !!corpo.aprovado);
    }
    if (corpo.nota !== undefined || corpo.comentario !== undefined || corpo.autorNome !== undefined) {
      await atualizarAvaliacaoAdmin(id, corpo.nota, corpo.comentario, corpo.autorNome);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const bloqueio = await bloqueioAdmin();
  if (bloqueio) return bloqueio;

  const { id } = await params;
  await excluirAvaliacao(id);
  return NextResponse.json({ ok: true });
}
