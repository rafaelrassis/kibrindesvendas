import { NextRequest, NextResponse } from "next/server";
import { bloqueioAdmin } from "@/lib/admin";
import { corpoJson, respostaDeErro } from "@/lib/api";
import { prisma } from "@/lib/prisma";

// Registra um clique em "Chamar" (WhatsApp) no painel de carrinhos.
export async function POST(req: NextRequest) {
  const bloqueio = await bloqueioAdmin();
  if (bloqueio) return bloqueio;

  try {
    const { usuarioId, email } = await corpoJson<{ usuarioId?: unknown; email?: unknown }>(req);
    const id = typeof usuarioId === "string" && usuarioId ? usuarioId.slice(0, 64) : null;
    const mail = typeof email === "string" && email ? email.slice(0, 254) : null;
    if (!id && !mail) return NextResponse.json({ error: "Contato inválido." }, { status: 400 });
    await prisma.contatoCarrinho.create({ data: { usuarioId: id, email: mail } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}
