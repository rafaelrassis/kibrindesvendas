import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { criarFaq, getFaqs, reordenarFaqs } from "@/lib/data/faq";
import { bloqueioAdmin } from "@/lib/admin";
import { corpoJson, respostaDeErro } from "@/lib/api";

export async function GET() {
  const bloqueio = await bloqueioAdmin();
  if (bloqueio) return bloqueio;

  return NextResponse.json(await getFaqs());
}

export async function POST(req: NextRequest) {
  const bloqueio = await bloqueioAdmin();
  if (bloqueio) return bloqueio;

  try {
    const faq = await criarFaq(await corpoJson(req));
    revalidatePath("/suporte");
    return NextResponse.json(faq);
  } catch (e) {
    return respostaDeErro(e);
  }
}

// Reordenar é da lista inteira, não de uma pergunta: a tela manda os ids na
// ordem nova e o servidor renumera todos de uma vez.
export async function PUT(req: NextRequest) {
  const bloqueio = await bloqueioAdmin();
  if (bloqueio) return bloqueio;

  try {
    const { ids } = await corpoJson<{ ids?: unknown }>(req);
    if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) {
      return NextResponse.json({ error: "Informe a ordem das perguntas." }, { status: 400 });
    }

    await reordenarFaqs(ids as string[]);
    revalidatePath("/suporte");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}
