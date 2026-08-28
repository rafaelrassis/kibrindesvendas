import { NextRequest, NextResponse } from "next/server";
import { criarVendaShopee, getVendasShopee } from "@/lib/data/vendas-shopee";
import { bloqueioAdmin } from "@/lib/admin";
import { corpoJson, respostaDeErro } from "@/lib/api";

export async function GET() {
  const bloqueio = await bloqueioAdmin();
  if (bloqueio) return bloqueio;

  return NextResponse.json(await getVendasShopee());
}

export async function POST(req: NextRequest) {
  const bloqueio = await bloqueioAdmin();
  if (bloqueio) return bloqueio;

  try {
    return NextResponse.json(await criarVendaShopee(await corpoJson(req)));
  } catch (e) {
    return respostaDeErro(e);
  }
}
