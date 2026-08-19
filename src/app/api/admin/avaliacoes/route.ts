import { NextResponse } from "next/server";
import { getAvaliacoesAdmin } from "@/lib/data/avaliacoes";
import { bloqueioAdmin } from "@/lib/admin";

export async function GET() {
  const bloqueio = await bloqueioAdmin();
  if (bloqueio) return bloqueio;

  return NextResponse.json(await getAvaliacoesAdmin());
}
