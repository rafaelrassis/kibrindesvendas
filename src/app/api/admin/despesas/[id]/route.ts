import { NextRequest, NextResponse } from "next/server";
import { removerDespesa } from "@/lib/data/despesas";
import { bloqueioAdmin } from "@/lib/admin";
import { respostaDeErro } from "@/lib/api";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const bloqueio = await bloqueioAdmin();
  if (bloqueio) return bloqueio;

  const { id } = await params;
  try {
    await removerDespesa(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}
