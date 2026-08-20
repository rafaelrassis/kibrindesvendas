import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { criarProduto, getProdutosAdmin } from "@/lib/data/produtos";
import { bloqueioAdmin } from "@/lib/admin";
import { corpoJson, respostaDeErro } from "@/lib/api";

export async function GET() {
  const bloqueio = await bloqueioAdmin();
  if (bloqueio) return bloqueio;

  return NextResponse.json(await getProdutosAdmin());
}

export async function POST(req: NextRequest) {
  const bloqueio = await bloqueioAdmin();
  if (bloqueio) return bloqueio;

  try {
    const produto = await criarProduto(await corpoJson(req));
    // A home fica até 60s em cache (`revalidate = 60`) — sem isso, produto
    // novo/editado só aparece lá quando o cache vencer sozinho.
    revalidatePath("/");
    revalidatePath(`/categoria/${produto.categoria}`);
    return NextResponse.json(produto);
  } catch (e) {
    return respostaDeErro(e);
  }
}
