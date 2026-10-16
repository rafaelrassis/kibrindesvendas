import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { corpoJson, respostaDeErro } from "@/lib/api";
import { checarLimite, ipDaRequisicao } from "@/lib/rate-limit";
import { SESSAO_VALIDA, tipoFunilValido } from "@/lib/funil";

const LIMITE = 60;
const JANELA_SEGUNDOS = 60 * 60;

export async function POST(req: NextRequest) {
  const limite = await checarLimite(`funil:${ipDaRequisicao(req.headers)}`, LIMITE, JANELA_SEGUNDOS);
  if (!limite.permitido) return NextResponse.json({ ok: false }, { status: 429 });

  try {
    const { sessao, tipo } = await corpoJson<{ sessao?: unknown; tipo?: unknown }>(req);
    if (typeof sessao !== "string" || !SESSAO_VALIDA.test(sessao) || !tipoFunilValido(tipo)) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    const dia = new Date().toISOString().slice(0, 10);
    await prisma.eventoFunil.createMany({ data: [{ sessao, tipo, dia }], skipDuplicates: true });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}
