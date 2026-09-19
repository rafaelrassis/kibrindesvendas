// Regras do DRE em funções puras (sem banco), pra testar sem Prisma. Toda a
// conta corre em centavos: somar Decimal em ponto flutuante desalinha centavos.

export const CATEGORIAS_DESPESA = [
  "Embalagem",
  "Marketing",
  "Assinaturas",
  "Impostos",
  "Pró-labore",
  "Outros",
] as const;
export type CategoriaDespesa = (typeof CATEGORIAS_DESPESA)[number];

export type CanalDRE = "todos" | "site" | "shopee";
export const CANAIS_DRE: CanalDRE[] = ["todos", "site", "shopee"];
export const LABEL_CANAL: Record<CanalDRE, string> = {
  todos: "Site + Shopee",
  site: "Só site",
  shopee: "Só Shopee",
};

export type PedidoParaDRE = {
  produtos: number; // soma de precoUnitario × quantidade
  desconto: number;
  frete: number; // cobrado do cliente
  reembolsado: number;
  custoMaterial: number;
  freteCusto: number | null; // pago à transportadora; null = não informado
  taxaGatewayPct: number; // 0 quando não configurada
};

export type VendaShopeeParaDRE = {
  valorVenda: number;
  custoTotal: number;
  // Soma dos campos "soma" menos os "subtrai" do snapshot: negativo = taxas.
  ajuste: number;
};

export type DRE = {
  receitaSite: number;
  receitaShopee: number;
  freteCobrado: number;
  receitaBruta: number;
  cupons: number;
  devolucoes: number;
  receitaLiquida: number;
  custoMaterial: number;
  lucroBruto: number;
  taxasGateway: number;
  taxasShopee: number;
  fretePago: number;
  despesas: number;
  resultado: number;
  margemPct: number;
  pedidosSite: number;
  vendasShopee: number;
  // Pedidos do site sem custo de frete informado: o resultado sai otimista.
  pedidosSemFreteCusto: number;
  despesasPorCategoria: { categoria: string; valor: number }[];
};

const c = (v: number) => Math.round(v * 100);

export function montarDRE(entrada: {
  pedidos: PedidoParaDRE[];
  shopee: VendaShopeeParaDRE[];
  despesas: { categoria: string; valor: number }[];
}): DRE {
  let receitaSite = 0;
  let freteCobrado = 0;
  let cupons = 0;
  let devolucoes = 0;
  let custoSite = 0;
  let taxasGateway = 0;
  let fretePago = 0;
  let pedidosSemFreteCusto = 0;

  for (const p of entrada.pedidos) {
    receitaSite += c(p.produtos);
    freteCobrado += c(p.frete);
    cupons += c(p.desconto);
    devolucoes += c(p.reembolsado);
    custoSite += c(p.custoMaterial);
    const cobrado = c(p.produtos) - c(p.desconto) + c(p.frete);
    taxasGateway += Math.round((cobrado * p.taxaGatewayPct) / 100);
    if (p.freteCusto == null) pedidosSemFreteCusto++;
    else fretePago += c(p.freteCusto);
  }

  let receitaShopee = 0;
  let custoShopee = 0;
  let taxasShopee = 0;
  for (const v of entrada.shopee) {
    receitaShopee += c(v.valorVenda);
    custoShopee += c(v.custoTotal);
    taxasShopee -= c(v.ajuste);
  }

  const porCategoria = new Map<string, number>();
  let despesas = 0;
  for (const d of entrada.despesas) {
    despesas += c(d.valor);
    porCategoria.set(d.categoria, (porCategoria.get(d.categoria) ?? 0) + c(d.valor));
  }

  const receitaBruta = receitaSite + receitaShopee + freteCobrado;
  const receitaLiquida = receitaBruta - cupons - devolucoes;
  const custoMaterial = custoSite + custoShopee;
  const lucroBruto = receitaLiquida - custoMaterial;
  const resultado = lucroBruto - taxasGateway - taxasShopee - fretePago - despesas;

  const r = (n: number) => n / 100;
  return {
    receitaSite: r(receitaSite),
    receitaShopee: r(receitaShopee),
    freteCobrado: r(freteCobrado),
    receitaBruta: r(receitaBruta),
    cupons: r(cupons),
    devolucoes: r(devolucoes),
    receitaLiquida: r(receitaLiquida),
    custoMaterial: r(custoMaterial),
    lucroBruto: r(lucroBruto),
    taxasGateway: r(taxasGateway),
    taxasShopee: r(taxasShopee),
    fretePago: r(fretePago),
    despesas: r(despesas),
    resultado: r(resultado),
    margemPct: receitaLiquida > 0 ? (resultado / receitaLiquida) * 100 : 0,
    pedidosSite: entrada.pedidos.length,
    vendasShopee: entrada.shopee.length,
    pedidosSemFreteCusto,
    despesasPorCategoria: Array.from(porCategoria.entries())
      .map(([categoria, valor]) => ({ categoria, valor: valor / 100 }))
      .sort((a, b) => b.valor - a.valor),
  };
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

// O servidor roda em UTC e a loja é de Brasília (-03:00 fixo, sem horário de
// verão desde 2019): sem fixar o fuso, um pedido das 22h de 30/09 cairia em
// outubro.
const CHAVE_DO_DIA = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function mesAtual(agora: number = Date.now()): string {
  return CHAVE_DO_DIA.format(agora).slice(0, 7);
}

const FORMATO_MES = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function periodoDoMes(mesBruto: string | undefined, agora: number = Date.now()) {
  const mes = mesBruto && FORMATO_MES.test(mesBruto) ? mesBruto : mesAtual(agora);
  const [ano, m] = mes.split("-").map(Number);
  const proximoAno = m === 12 ? ano + 1 : ano;
  const proximoMes = m === 12 ? 1 : m + 1;
  return {
    mes,
    rotulo: `${MESES[m - 1]}/${ano}`,
    inicio: new Date(`${mes}-01T00:00:00-03:00`),
    fim: new Date(`${proximoAno}-${String(proximoMes).padStart(2, "0")}-01T00:00:00-03:00`),
  };
}

// Últimos `quantidade` meses, do mais recente pro mais antigo, pro select.
export function ultimosMeses(quantidade = 12, agora: number = Date.now()) {
  const [ano, m] = mesAtual(agora).split("-").map(Number);
  const lista: { mes: string; rotulo: string }[] = [];
  for (let i = 0; i < quantidade; i++) {
    const indice = ano * 12 + (m - 1) - i;
    const a = Math.floor(indice / 12);
    const mm = (indice % 12) + 1;
    lista.push({ mes: `${a}-${String(mm).padStart(2, "0")}`, rotulo: `${MESES[mm - 1]}/${a}` });
  }
  return lista;
}

export function canalValido(valor: string | undefined): CanalDRE {
  return CANAIS_DRE.find((c) => c === valor) ?? "todos";
}
