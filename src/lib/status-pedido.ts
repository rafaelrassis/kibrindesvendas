// Rótulos e cores do StatusPedido em um lugar só: a mesma lista alimenta o
// select do admin, a lista de pedidos do cliente e o detalhe do pedido.
// A ordem é a do fluxo real, e é ela que o select do admin usa.

export const STATUS_PEDIDO = [
  "AGUARDANDO_PAGAMENTO",
  "PAGO",
  "EM_PRODUCAO",
  "ENVIADO",
  "ENTREGUE",
  "DEVOLUCAO_SOLICITADA",
  "DEVOLVIDO",
  "CANCELADO",
] as const;

export type StatusPedido = (typeof STATUS_PEDIDO)[number];

export const LABEL_STATUS: Record<StatusPedido, string> = {
  AGUARDANDO_PAGAMENTO: "Aguardando pagamento",
  PAGO: "Pago",
  EM_PRODUCAO: "Em produção",
  ENVIADO: "Enviado",
  ENTREGUE: "Entregue",
  DEVOLUCAO_SOLICITADA: "Devolução solicitada",
  DEVOLVIDO: "Devolvido",
  CANCELADO: "Cancelado",
};

// Classes do Tailwind (admin, fundo claro).
export const CLASSE_STATUS: Record<StatusPedido, string> = {
  AGUARDANDO_PAGAMENTO: "bg-ink/5 text-ink/50",
  PAGO: "bg-mustard/20 text-pine-2",
  EM_PRODUCAO: "bg-mustard/20 text-pine-2",
  ENVIADO: "bg-pine/10 text-pine",
  ENTREGUE: "bg-pine/15 text-pine",
  DEVOLUCAO_SOLICITADA: "bg-berry/10 text-berry",
  DEVOLVIDO: "bg-ink/5 text-ink/50",
  CANCELADO: "bg-berry/10 text-berry",
};

// Cor crua pro selo da lista do cliente, que monta fundo e texto na hora.
export const COR_STATUS: Record<StatusPedido, string> = {
  AGUARDANDO_PAGAMENTO: "#8A8A8A",
  PAGO: "#D9A63E",
  EM_PRODUCAO: "#D9A63E",
  ENVIADO: "#9C1C95",
  ENTREGUE: "#3F6B4C",
  DEVOLUCAO_SOLICITADA: "#B23A48",
  DEVOLVIDO: "#8A8A8A",
  CANCELADO: "#B23A48",
};

export function labelStatus(status: string) {
  return LABEL_STATUS[status as StatusPedido] ?? status;
}

// A devolução só existe depois que o pedido chegou: antes disso o caminho é
// cancelar, e depois de solicitada não adianta pedir de novo.
export function podeSolicitarDevolucao(status: string) {
  return status === "ENTREGUE";
}
