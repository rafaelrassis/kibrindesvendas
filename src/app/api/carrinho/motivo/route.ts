import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { corpoJson, respostaDeErro } from "@/lib/api";
import { checarLimite, ipDaRequisicao } from "@/lib/rate-limit";
import { motivoValido } from "@/lib/motivo-abandono";

// O cliente conta, pelo link do e-mail de 72h, o que o impediu de finalizar. O
// id do lembrete é o "token"; só a primeira resposta vale.
export async function POST(req: NextRequest) {
  const limite = await checarLimite(`motivo:${ipDaRequisicao(req.headers)}`, 20, 60 * 60);
  if (!limite.permitido) {
    return NextResponse.json({ error: "Muitas tentativas." }, { status: 429 });
  }

  try {
    const { l, motivo } = await corpoJson<{ l?: unknown; motivo?: unknown }>(req);
    if (typeof l !== "string" || l.length < 8 || l.length > 64 || !motivoValido(motivo)) {
      return NextResponse.json({ error: "Resposta inválida." }, { status: 400 });
    }
    await prisma.lembreteCarrinho.updateMany({ where: { id: l, motivo: null }, data: { motivo } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}
