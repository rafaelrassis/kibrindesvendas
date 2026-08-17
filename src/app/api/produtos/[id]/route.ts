import { NextRequest, NextResponse } from "next/server";
import { getProduto } from "@/lib/data/produtos";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const produto = await getProduto(id);
  if (!produto) return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });
  return NextResponse.json(produto);
}
