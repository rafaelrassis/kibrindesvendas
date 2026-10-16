// Assuntos do e-mail de carrinho esquecido (teste A/B). Puro: sem banco nem e-mail.

export type VarianteAssunto = "A" | "B";

// Mesma conta sempre cai na mesma variante (paridade da soma dos caracteres do
// id), então o 2º lembrete segue o 1º e o painel compara grupos estáveis.
export function varianteDoAssunto(usuarioId: string): VarianteAssunto {
  let soma = 0;
  for (let i = 0; i < usuarioId.length; i++) soma += usuarioId.charCodeAt(i);
  return soma % 2 === 0 ? "A" : "B";
}

export function assuntoDoLembrete(
  tipo: 1 | 2,
  variante: VarianteAssunto,
  percentual?: number
): string {
  if (tipo === 2) {
    return variante === "A"
      ? `${percentual}% de desconto no seu carrinho — LeoKibrindes`
      : `Última chance: ${percentual}% OFF nos itens que você escolheu`;
  }
  return variante === "A"
    ? "Você esqueceu itens no carrinho — LeoKibrindes"
    : "Seus itens estão guardados pra você 🎁";
}
