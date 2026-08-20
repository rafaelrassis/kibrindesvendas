import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { criarCategoria } from "@/lib/data/categorias";
import { bloqueioAdmin } from "@/lib/admin";
import { corpoJson, respostaDeErro } from "@/lib/api";

export async function POST(req: NextRequest) {
  const bloqueio = await bloqueioAdmin();
  if (bloqueio) return bloqueio;

  try {
    const { label, imagemUrl } = await corpoJson<{ label?: string; imagemUrl?: string | null }>(
      req
    );
    if (!label?.trim()) {
      return NextResponse.json({ error: "Informe o nome da categoria." }, { status: 400 });
    }

    const categoria = await criarCategoria(label, imagemUrl);
    revalidatePath("/");
    revalidatePath("/categorias");
    return NextResponse.json(categoria);
  } catch (e) {
    return respostaDeErro(e);
  }
}
