import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { LABEL_STATUS, STATUS_PEDIDO, type StatusPedido } from "@/lib/status-pedido";
import { custoEfetivo } from "@/lib/estoque-variacao";

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
export type FreteServico = { servico: string; quantidade: number };
export type ProdutoEstoqueBaixo = { nome: string; combinacao: string | null; estoque: number };
export type CanalDeVenda = { canal: "Site" | "Shopee"; total: number; pedidos: number; ticketMedio: number };
export type CupomUsado = { codigo: string; usos: number; descontoTotal: number };

export type ResumoDoPainel = {
  totalVendas: number;
  totalPedidos: number;
  ticketMedio: number;
  totalDevolucoes: number;
  taxaDevolucao: number;
  lucroEstimado: number;
  margemPct: number;
  descontoTotalConcedido: number;
};

export type DadosDoPainel = {
  vendasPorDia: VendaDoDia[];
  pedidosPorStatus: FatiaDeStatus[];
  produtosMaisVendidos: ProdutoVendido[];
  vendasPorFrete: FreteServico[];
  estoqueBaixo: ProdutoEstoqueBaixo[];
  vendasPorCanal: CanalDeVenda[];
  cuponsMaisUsados: CupomUsado[];
  resumo: ResumoDoPainel;
};

// Abaixo disso o admin já deveria ficar de olho — acima, não vale poluir a
// lista com toda combinação que só tem "bastante" estoque.
const LIMIAR_ESTOQUE_BAIXO = 5;

// Somar Decimal em ponto flutuante desalinha os centavos (39.9 + 16.9 dá
// 56.800000000000004): a conta corre em centavos e só volta pra reais no fim.
function emCentavos(valor: Prisma.Decimal) {
  return Math.round(Number(valor) * 100);
}

export async function getDadosDoPainel(): Promise<DadosDoPainel> {
  const agora = Date.now();
  const inicio = new Date(`${CHAVE_DO_DIA.format(agora - (DIAS - 1) * UM_DIA)}T00:00:00-03:00`);

  const [
    pedidos,
    produtosMaisVendidos,
    lucroEstimado,
    vendasPorFrete,
    estoqueBaixo,
    vendasPorCanal,
    cupons,
  ] = await Promise.all([
    // Só as três colunas que o painel usa: o gráfico não precisa dos itens nem
    // do endereço de cada pedido do mês.
    prisma.pedido.findMany({
      where: { createdAt: { gte: inicio } },
      select: { status: true, total: true, createdAt: true },
    }),
    getProdutosMaisVendidos(inicio),
    getLucroEstimado(inicio),
    getVendasPorFrete(inicio),
    getEstoqueBaixo(),
    getVendasPorCanal(inicio),
    getCuponsMaisUsados(inicio),
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

  const totalVendas = centavosVendidos / 100;

  return {
    vendasPorDia,
    pedidosPorStatus,
    produtosMaisVendidos,
    vendasPorFrete,
    estoqueBaixo,
    vendasPorCanal,
    cuponsMaisUsados: cupons.itens,
    resumo: {
      totalVendas,
      totalPedidos,
      ticketMedio: totalPedidos > 0 ? Math.round(centavosVendidos / totalPedidos) / 100 : 0,
      totalDevolucoes,
      taxaDevolucao: totalPedidos > 0 ? (totalDevolucoes / totalPedidos) * 100 : 0,
      lucroEstimado,
      margemPct: totalVendas > 0 ? (lucroEstimado / totalVendas) * 100 : 0,
      descontoTotalConcedido: cupons.descontoTotal,
    },
  };
}

// Lucro = faturamento (já contado acima via pedido.total) menos o custo de
// material de cada item vendido, na variação efetivamente escolhida. Não
// desconta frete/comissão — é custo de produto puro, igual ao usado no
// cadastro. Dado sensível: só chega até o painel admin, nunca à API pública.
async function getLucroEstimado(inicio: Date): Promise<number> {
  const itens = await prisma.itemPedido.findMany({
    where: { pedido: { createdAt: { gte: inicio }, status: { in: STATUS_DE_VENDA } } },
    select: {
      quantidade: true,
      precoUnitario: true,
      variacaoEscolhida: true,
      produto: { include: { materiais: true, variacoes: true } },
    },
  });

  let centavosFaturados = 0;
  let centavosCusto = 0;
  for (const item of itens) {
    const custoTotalProduto = item.produto.materiais.reduce(
      (soma, m) => soma + Number(m.quantidade) * Number(m.custoUnitario),
      0
    );
    const selecoes = (item.variacaoEscolhida as Record<string, string> | null) ?? {};
    const custoUnitario = custoEfetivo(
      { custoTotal: custoTotalProduto, variacoes: item.produto.variacoes.map((v) => ({
        tipo: v.tipo,
        custosValores: v.custosValores as Record<string, number> | null,
      })) },
      selecoes
    );
    centavosFaturados += emCentavos(item.precoUnitario) * item.quantidade;
    centavosCusto += Math.round(custoUnitario * 100) * item.quantidade;
  }

  return (centavosFaturados - centavosCusto) / 100;
}

// Serviço de frete escolhido em cada pedido pago (PAC, SEDEX...). null vira
// "Grátis / estimado" — frete zerado por cupom/limiar ou sem transportadora
// configurada.
async function getVendasPorFrete(inicio: Date): Promise<FreteServico[]> {
  const pedidos = await prisma.pedido.findMany({
    where: { createdAt: { gte: inicio }, status: { in: STATUS_DE_VENDA } },
    select: { freteServico: true },
  });

  const porServico = new Map<string, number>();
  for (const p of pedidos) {
    const chave = p.freteServico ?? "Grátis / estimado";
    porServico.set(chave, (porServico.get(chave) ?? 0) + 1);
  }

  return Array.from(porServico.entries())
    .map(([servico, quantidade]) => ({ servico, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade);
}

// Combinações com controle de estoque ligado e quantidade baixa ou zerada —
// mesmo critério de "esgotado" usado no checkout (linha com 0). Produto sem
// controle por variação (estoque simples) entra do mesmo jeito, olhando
// produto.estoque.
async function getEstoqueBaixo(): Promise<ProdutoEstoqueBaixo[]> {
  const [variacoes, produtosSimples] = await Promise.all([
    prisma.estoqueVariacao.findMany({
      where: { estoque: { lte: LIMIAR_ESTOQUE_BAIXO } },
      select: { estoque: true, combinacao: true, produto: { select: { nome: true, emoji: true, ativo: true } } },
    }),
    prisma.produto.findMany({
      where: { ativo: true, estoque: { lte: LIMIAR_ESTOQUE_BAIXO } },
      select: { nome: true, emoji: true, estoque: true },
    }),
  ]);

  const doVariacoes = variacoes
    .filter((v) => v.produto.ativo)
    .map((v) => ({
      nome: `${v.produto.emoji} ${v.produto.nome}`,
      combinacao: v.combinacao,
      estoque: v.estoque,
    }));

  const doSimples = produtosSimples.map((p) => ({
    nome: `${p.emoji} ${p.nome}`,
    combinacao: null,
    estoque: p.estoque!,
  }));

  return [...doVariacoes, ...doSimples].sort((a, b) => a.estoque - b.estoque);
}

// Compara o faturamento do site (pedidos pagos) com as vendas lançadas
// manualmente na Shopee no mesmo período — os dois canais vendem o mesmo
// catálogo, então o painel só fazia sentido de um lado até agora.
async function getVendasPorCanal(inicio: Date): Promise<CanalDeVenda[]> {
  const [pedidos, shopee] = await Promise.all([
    prisma.pedido.findMany({
      where: { createdAt: { gte: inicio }, status: { in: STATUS_DE_VENDA } },
      select: { total: true },
    }),
    prisma.vendaShopee.findMany({
      where: { createdAt: { gte: inicio } },
      select: { valorVenda: true },
    }),
  ]);

  const totalSite = pedidos.reduce((soma, p) => soma + emCentavos(p.total), 0) / 100;
  const totalShopee = shopee.reduce((soma, v) => soma + emCentavos(v.valorVenda), 0) / 100;
  const qtdShopee = shopee.length;

  return [
    {
      canal: "Site",
      total: totalSite,
      pedidos: pedidos.length,
      ticketMedio: pedidos.length > 0 ? Math.round((totalSite / pedidos.length) * 100) / 100 : 0,
    },
    {
      canal: "Shopee",
      total: totalShopee,
      pedidos: qtdShopee,
      ticketMedio: qtdShopee > 0 ? Math.round((totalShopee / qtdShopee) * 100) / 100 : 0,
    },
  ];
}

// Desconto concedido é congelado em Pedido.desconto no momento da compra —
// não recalcula se o cupom mudar depois. Cupom apagado continua aparecendo
// (o código fica gravado no pedido mesmo sem o registro do Cupom existir mais).
async function getCuponsMaisUsados(
  inicio: Date
): Promise<{ itens: CupomUsado[]; descontoTotal: number }> {
  const pedidos = await prisma.pedido.findMany({
    where: {
      createdAt: { gte: inicio },
      status: { in: STATUS_DE_VENDA },
      cupomCodigo: { not: null },
    },
    select: { cupomCodigo: true, desconto: true },
  });

  const porCupom = new Map<string, { usos: number; centavos: number }>();
  let centavosTotal = 0;
  for (const p of pedidos) {
    const codigo = p.cupomCodigo!;
    const centavos = emCentavos(p.desconto);
    centavosTotal += centavos;
    const atual = porCupom.get(codigo) ?? { usos: 0, centavos: 0 };
    porCupom.set(codigo, { usos: atual.usos + 1, centavos: atual.centavos + centavos });
  }

  const itens = Array.from(porCupom.entries())
    .map(([codigo, v]) => ({ codigo, usos: v.usos, descontoTotal: v.centavos / 100 }))
    .sort((a, b) => b.usos - a.usos);

  return { itens, descontoTotal: centavosTotal / 100 };
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
