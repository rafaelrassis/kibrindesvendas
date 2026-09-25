import { NextRequest, NextResponse } from "next/server";
import { executarCicloAgendado } from "@/lib/data/sync-fornecedor";
import { revalidarProdutos } from "@/lib/revalidar-produtos";

// Chamado de hora em hora (GitHub Actions — ver
// .github/workflows/sync-fornecedor.yml — e o cron diário da Vercel como
// reserva). Quem decide se roda é a agenda salva em Configurações; fora do
// horário a chamada só responde "nada a fazer".
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const segredo = process.env.CRON_SECRET;
  // Mesmo formato que o cron da Vercel manda sozinho quando CRON_SECRET existe.
  if (!segredo || req.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const r = await executarCicloAgendado();
  revalidarProdutos(r.resultados);
  return NextResponse.json({
    executou: r.executou,
    motivo: r.motivo,
    pendentes: r.pendentes,
    processados: r.resultados.length,
    erros: r.resultados.filter((x) => !x.ok).map((x) => ({ produto: x.nome, erro: x.erro })),
  });
}
