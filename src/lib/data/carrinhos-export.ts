import "server-only";
import { prisma } from "@/lib/prisma";
import { atribuirRecuperacao } from "@/lib/recuperacao-carrinho";

const DIA = 24 * 60 * 60 * 1000;

// Campo de CSV: aspas quando preciso e proteção contra fórmula (=, +, -, @) ao
// abrir no Excel/Sheets.
function campo(v: string | number | null): string {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[";\n,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Um lembrete por linha, com as variantes dos testes A/B e o resultado.
export async function exportarLembretesCsv(dias: number, agora = new Date()): Promise<string> {
  const desde = new Date(agora.getTime() - dias * DIA);
  const enviados = await prisma.lembreteCarrinho.findMany({
    where: { enviadoEm: { gte: desde } },
    orderBy: { enviadoEm: "asc" },
  });
  const pedidos = enviados.length
    ? await prisma.pedido.findMany({
        where: {
          usuarioId: { in: [...new Set(enviados.map((e) => e.usuarioId))] },
          createdAt: { gte: desde },
          status: { not: "CANCELADO" },
        },
        select: { usuarioId: true, total: true, createdAt: true },
      })
    : [];
  const recuperadoPor = atribuirRecuperacao(
    enviados,
    pedidos.map((p) => ({ usuarioId: p.usuarioId, total: Number(p.total), createdAt: p.createdAt }))
  );

  const linhas = [
    ["enviado_em", "tipo", "variante_assunto", "variante_desconto", "cupom", "valor_carrinho", "recuperado", "receita"],
    ...enviados.map((e) => [
      e.enviadoEm.toISOString(),
      e.tipo === 1 ? "24h" : "72h",
      e.variante,
      e.varianteCupom,
      e.cupomCodigo,
      Number(e.valorCarrinho).toFixed(2),
      recuperadoPor.has(e.id) ? "sim" : "nao",
      (recuperadoPor.get(e.id) ?? 0).toFixed(2),
    ]),
  ];
  // BOM pro Excel abrir em UTF-8; ";" não é usado: vírgula é o padrão do Sheets.
  return "\uFEFF" + linhas.map((l) => l.map(campo).join(",")).join("\r\n") + "\r\n";
}
