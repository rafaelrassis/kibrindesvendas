import { NextRequest, NextResponse } from "next/server";
import { enviarResumoSemanalCarrinhos } from "@/lib/data/carrinhos-resumo";

// Cron semanal da Vercel (ver vercel.json): resumo dos carrinhos pro admin.
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || req.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  return NextResponse.json(await enviarResumoSemanalCarrinhos());
}
