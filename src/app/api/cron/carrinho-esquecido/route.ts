import { NextRequest, NextResponse } from "next/server";
import { enviarLembretesCarrinho } from "@/lib/data/carrinho-esquecido";

// Cron diário da Vercel (ver vercel.json): lembra quem deixou o carrinho parado.
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const segredo = process.env.CRON_SECRET;
  // Mesmo formato que o cron da Vercel manda sozinho quando CRON_SECRET existe.
  if (!segredo || req.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  return NextResponse.json(await enviarLembretesCarrinho());
}
