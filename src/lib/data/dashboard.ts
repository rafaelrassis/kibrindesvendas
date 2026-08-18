import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { LABEL_STATUS, STATUS_PEDIDO, type StatusPedido } from "@/lib/status-pedido";

// Janela do painel: hoje e os 29 dias anteriores.
const DIAS = 30;
const TOP_PRODUTOS = 5;
const UM_DIA = 24 * 60 * 60 * 1000;

// A loja é brasileira e o servidor roda em UTC: sem fixar o fuso, um pedido
// das 21h de Brasília entraria no gráfico como venda do dia seguinte. O Brasil
// não tem mais horário de verão desde 2019, então o -03:00 é fixo.
const FUSO = "America/Sao_Paulo";
const CHAVE_DO_DIA = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const ROTULO_DO_DIA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO,
  day: "2-digit",
  month: "2-digit",
});

// Só pedido pago entra no faturamento. Devolvido continua contando como venda
// do período (o dinheiro chegou a entrar) e reaparece na taxa de devolução.
// Escrever status por status obriga a decidir o que fazer com o próximo que
// for criado, em vez de deixá-lo sumir da conta em silêncio.
const CONTA_COMO_VENDA: Record<StatusPedido, boolean> = {
  AGUARDANDO_PAGAMENTO: false,
  PAGO: true,
  EM_PRODUCAO: true,
  ENVIADO: true,
  ENTREGUE: true,
  DEVOLUCAO_SOLICITADA: true,
  DEVOLVIDO: true,
  CANCELADO: false,
};

// O selo de status (COR_STATUS) repete cor de propósito — ele só precisa
// separar "tudo certo" de "deu problema". Numa pizza de oito fatias isso vira
// fatia colada em fatia da mesma cor, então o gráfico tem paleta própria, com
// um tom distinto por status.
const COR_NO_GRAFICO: Record<StatusPedido, string> = {
  AGUARDANDO_PAGAMENTO: "#b9a7b8",
  PAGO: "#d9a63e",
  EM_PRODUCAO: "#b8801f",
  ENVIADO: "#9c1c95",
  ENTREGUE: "#3f6b4c",
  DEVOLUCAO_SOLICITADA: "#b23a48",
  DEVOLVIDO: "#7d2934",
  CANCELADO: "#6b6470",
};

const STATUS_DE_VENDA = STATUS_PEDIDO.filter((s) => CONTA_COMO_VENDA[s]);
const STATUS_DE_DEVOLUCAO: StatusPedido[] = ["DEVOLUCAO_SOLICITADA", "DEVOLVIDO"];

export type VendaDoDia = { dia: string; total: number };
export type FatiaDeStatus = { status: StatusPedido; label: string; cor: string; quantidade: number };
export type ProdutoVendido = { nome: string; quantidade: number };

export type ResumoDoPainel = {
  totalVendas: number;
  totalPedidos: number;
  ticketMedio: number;
  totalDevolucoes: number;
  taxaDevolucao: number;
};

export type DadosDoPainel = {
  vendasPorDia: VendaDoDia[];
  pedidosPorStatus: FatiaDeStatus[];
  produtosMaisVendidos: ProdutoVendido[];
  resumo: ResumoDoPainel;
};

// Somar Decimal em ponto flutuante desalinha os centavos (39.9 + 16.9 dá
// 56.800000000000004): a conta corre em centavos e só volta pra reais no fim.
function emCentavos(valor: Prisma.Decimal) {
  return Math.round(Number(valor) * 100);
}

export async function getDadosDoPainel(): Promise<DadosDoPainel> {
  const agora = Date.now();
  const inicio = new Date(`${CHAVE_DO_DIA.format(agora - (DIAS - 1) * UM_DIA)}T00:00:00-03:00`);

  const [pedidos, produtosMaisVendidos] = await Promise.all([
    // Só as três colunas que o painel usa: o gráfico não precisa dos itens nem
    // do endereço de cada pedido do mês.
    prisma.pedido.findMany({
      where: { createdAt: { gte: inicio } },
      select: { status: true, total: true, createdAt: true },
    }),
    getProdutosMaisVendidos(inicio),
  ]);

  // Dia sem venda tem que aparecer como zero, senão a linha do gráfico pula o
  // buraco e finge que o movimento foi contínuo.
  const centavosPorDia = new Map<string, number>();
  const vendasPorDia: VendaDoDia[] = [];
  for (let i = DIAS - 1; i >= 0; i--) {
    centavosPorDia.set(CHAVE_DO_DIA.format(agora - i * UM_DIA), 0);
    vendasPorDia.push({ dia: ROTULO_DO_DIA.format(agora - i * UM_DIA), total: 0 });
  }

  const porStatus = new Map<StatusPedido, number>();
  let centavosVendidos = 0;
  let totalPedidos = 0;
  let totalDevolucoes = 0;

  for (const pedido of pedidos) {
    porStatus.set(pedido.status, (porStatus.get(pedido.status) ?? 0) + 1);
    if (STATUS_DE_DEVOLUCAO.includes(pedido.status)) totalDevolucoes++;
    if (!CONTA_COMO_VENDA[pedido.status]) continue;

    const centavos = emCentavos(pedido.total);
    centavosVendidos += centavos;
    totalPedidos++;

    const chave = CHAVE_DO_DIA.format(pedido.createdAt);
    // Um pedido criado no limite exato da janela pode cair fora dos 30 dias
    // montados acima; sem o guarda ele viraria um dia fantasma no gráfico.
    if (centavosPorDia.has(chave)) {
      centavosPorDia.set(chave, centavosPorDia.get(chave)! + centavos);
    }
  }

  Array.from(centavosPorDia.values()).forEach((centavos, i) => {
    vendasPorDia[i].total = centavos / 100;
  });

  // Na ordem do fluxo (status-pedido.ts), não na ordem em que os pedidos
  // vieram do banco: assim a legenda não troca de lugar a cada carregamento.
  const pedidosPorStatus = STATUS_PEDIDO.filter((status) => porStatus.has(status)).map(
    (status) => ({
      status,
      label: LABEL_STATUS[status],
      cor: COR_NO_GRAFICO[status],
      quantidade: porStatus.get(status)!,
    })
  );

  return {
    vendasPorDia,
    pedidosPorStatus,
    produtosMaisVendidos,
    resumo: {
      totalVendas: centavosVendidos / 100,
      totalPedidos,
      ticketMedio: totalPedidos > 0 ? Math.round(centavosVendidos / totalPedidos) / 100 : 0,
      totalDevolucoes,
      taxaDevolucao: totalPedidos > 0 ? (totalDevolucoes / totalPedidos) * 100 : 0,
    },
  };
}

// A soma por produto sai do banco: a lista de itens do período inteiro não
// precisa vir pra memória só pra virar um ranking de cinco linhas.
async function getProdutosMaisVendidos(inicio: Date): Promise<ProdutoVendido[]> {
  const somas = await prisma.itemPedido.groupBy({
    by: ["produtoId"],
    where: { pedido: { createdAt: { gte: inicio }, status: { in: STATUS_DE_VENDA } } },
    _sum: { quantidade: true },
    orderBy: { _sum: { quantidade: "desc" } },
    take: TOP_PRODUTOS,
  });
  if (somas.length === 0) return [];

  const produtos = await prisma.produto.findMany({
    where: { id: { in: somas.map((s) => s.produtoId) } },
    select: { id: true, nome: true, emoji: true },
  });
  const porId = new Map(produtos.map((p) => [p.id, p]));

  return somas.map((soma) => {
    const produto = porId.get(soma.produtoId);
    return {
      nome: produto ? `${produto.emoji} ${produto.nome}` : soma.produtoId,
      quantidade: soma._sum.quantidade ?? 0,
    };
  });
}
