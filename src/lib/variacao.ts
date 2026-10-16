// Variação entre semanas, em texto curto pro resumo e pro painel.

export function variacaoTexto(atual: number, anterior: number): string {
  if (anterior === 0) return atual === 0 ? "sem mudança" : "novo";
  const pct = ((atual - anterior) / anterior) * 100;
  if (Math.abs(pct) < 0.5) return "sem mudança";
  const sinal = pct > 0 ? "+" : "−";
  return `${sinal}${Math.abs(pct).toFixed(0)}% vs. semana anterior`;
}
