import type { MotivoAbandono } from "./motivo-abandono";

// Só ajusta o e-mail quando há resposta suficiente e um motivo claramente
// à frente — com poucas respostas qualquer motivo "ganha" por acaso.
export function motivoDominante(
  contagens: Partial<Record<MotivoAbandono, number>>,
  minimoRespostas = 10,
  minimoParticipacao = 0.4
): MotivoAbandono | null {
  const entradas = Object.entries(contagens) as [MotivoAbandono, number][];
  const total = entradas.reduce((s, [, n]) => s + n, 0);
  if (total < minimoRespostas) return null;
  const [motivo, n] = [...entradas].sort((a, b) => b[1] - a[1])[0];
  if (motivo === "outro") return null;
  return n / total >= minimoParticipacao ? motivo : null;
}

// Frase de destaque do e-mail de 72h conforme o motivo mais comum.
export function destaqueDoEmail(
  motivo: MotivoAbandono | null,
  freteGratisAcimaDe: number | null
): string | null {
  switch (motivo) {
    case "frete":
      return freteGratisAcimaDe
        ? `Frete grátis em compras acima de ${freteGratisAcimaDe.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`
        : null;
    case "preco":
      return "Seu cupom está valendo: é o menor preço que conseguimos fazer pra você.";
    case "duvida":
      return "Ficou com alguma dúvida? Responda este e-mail que a gente te ajuda.";
    default:
      return null;
  }
}
