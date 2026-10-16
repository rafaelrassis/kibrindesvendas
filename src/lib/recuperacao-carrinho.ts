// Atribuição de pedidos aos lembretes de carrinho que os recuperaram. Puro (sem
// banco) pra poder ser testado: ver getPainelCarrinhos.

const DIA = 24 * 60 * 60 * 1000;
export const JANELA_RECUPERACAO_DIAS = 7;

export type LembreteParaAtribuir = { id: string; usuarioId: string; enviadoEm: Date };
export type PedidoParaAtribuir = { usuarioId: string; total: number; createdAt: Date };

// Um pedido do mesmo cliente feito depois do lembrete, em até 7 dias, é
// "recuperado". Se houver mais de um lembrete elegível, só o mais recente leva
// o crédito — a receita nunca é contada duas vezes. Devolve id do lembrete ->
// receita atribuída; lembrete que não aparece no mapa não recuperou nada.
export function atribuirRecuperacao(
  lembretes: LembreteParaAtribuir[],
  pedidos: PedidoParaAtribuir[]
): Map<string, number> {
  const ordenados = [...lembretes].sort((a, b) => a.enviadoEm.getTime() - b.enviadoEm.getTime());
  const recuperado = new Map<string, number>();

  for (const p of pedidos) {
    const elegiveis = ordenados.filter(
      (l) =>
        l.usuarioId === p.usuarioId &&
        l.enviadoEm < p.createdAt &&
        p.createdAt.getTime() - l.enviadoEm.getTime() <= JANELA_RECUPERACAO_DIAS * DIA
    );
    const credito = elegiveis.at(-1);
    if (credito) recuperado.set(credito.id, (recuperado.get(credito.id) ?? 0) + p.total);
  }
  return recuperado;
}
