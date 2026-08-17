import "server-only";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ErroDeNegocio } from "@/lib/data/erros";

// `req.json()` estoura com corpo vazio ou malformado. Sem isso a rota devolve
// 500 num erro que é do cliente, e o erro do Prisma nem chega a acontecer.
export async function corpoJson<T = Record<string, unknown>>(req: NextRequest): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new ErroDeNegocio("Corpo da requisição inválido: esperado JSON.");
  }
}

// Traduz os erros esperados da camada de dados pro JSON das rotas; o resto
// sobe e vira 500, que é o certo pra falha inesperada.
export function respostaDeErro(e: unknown) {
  if (e instanceof ErroDeNegocio) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  throw e;
}
