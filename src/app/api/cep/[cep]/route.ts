import { NextRequest, NextResponse } from "next/server";
import { consultarCep } from "@/lib/data/entrega";
import { respostaDeErro } from "@/lib/api";

// Usada pelo checkout (calcular frete) e pelo cadastro de endereço
// (preencher rua/bairro/cidade a partir do CEP).
export async function GET(req: NextRequest, { params }: { params: Promise<{ cep: string }> }) {
  const { cep } = await params;
  const produtoId = req.nextUrl.searchParams.get("produtoId") ?? undefined;
  const quantidade = req.nextUrl.searchParams.get("quantidade") ?? undefined;
  const servico = req.nextUrl.searchParams.get("servico") ?? undefined;
  const variacoes = req.nextUrl.searchParams.get("variacoes") ?? undefined;

  try {
    return NextResponse.json(
      await consultarCep(cep, produtoId, quantidade, servico, variacoes)
    );
  } catch (e) {
    return respostaDeErro(e);
  }
}
