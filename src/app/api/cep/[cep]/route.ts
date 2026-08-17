import { NextRequest, NextResponse } from "next/server";
import { consultarCep } from "@/lib/data/entrega";
import { respostaDeErro } from "@/lib/api";

// Usada pelo checkout (calcular frete) e pelo cadastro de endereço
// (preencher rua/bairro/cidade a partir do CEP).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ cep: string }> }) {
  const { cep } = await params;

  try {
    return NextResponse.json(await consultarCep(cep));
  } catch (e) {
    return respostaDeErro(e);
  }
}
