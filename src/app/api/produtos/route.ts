import { NextRequest, NextResponse } from "next/server";
import { getProdutos, buscarProdutos, getProdutosPorCategoria } from "@/lib/data/produtos";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  const categoria = searchParams.get("categoria");

  if (q) return NextResponse.json(await buscarProdutos(q));
  if (categoria) return NextResponse.json(await getProdutosPorCategoria(categoria));
  return NextResponse.json(await getProdutos());
}
