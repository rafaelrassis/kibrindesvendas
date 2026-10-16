import { NextRequest, NextResponse } from "next/server";
import { bloqueioAdmin } from "@/lib/admin";
import { corpoJson, respostaDeErro } from "@/lib/api";
import { prisma } from "@/lib/prisma";

// "Marcar como resolvido": o carrinho sai da lista de parados até o cliente
// mexer nele de novo.
export async function POST(req: NextRequest) {
  const bloqueio = await bloqueioAdmin();
  if (bloqueio) return bloqueio;

  try {
    const { usuarioId, email } = await corpoJson<{ usuarioId?: unknown; email?: unknown }>(req);
    const id = typeof usuarioId === "string" && usuarioId ? usuarioId.slice(0, 64) : null;
    const mail = typeof email === "string" && email ? email.slice(0, 254) : null;
    if (!id && !mail) return NextResponse.json({ error: "Carrinho inválido." }, { status: 400 });
    await prisma.resolvidoCarrinho.create({ data: { usuarioId: id, email: mail } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}
