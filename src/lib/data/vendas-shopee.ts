import "server-only";
import { prisma } from "@/lib/prisma";
import { custoEfetivo } from "@/lib/estoque-variacao";
import { getConfiguracaoLoja } from "./configuracao";
import { normalizarPrecosValores } from "./produtos";
import { ErroDeNegocio } from "./erros";
import type { Prisma } from "@prisma/client";

export type VendaShopee = {
  id: string;
  produtoId: string;
  produtoNome: string;
  combinacao: string | null;
  quantidade: number;
  valorVenda: number;
  custoTotal: number;
  comissaoPct: number;
  fretePct: number;
  adsPct: number;
  // Valor fixo em R$ cobrado pela Shopee por venda (não percentual).
  taxaFixa: number;
  // Derivados — não guardados no banco, calculados na leitura a partir do
  // snapshot acima (nunca recalculam custo/margem do produto atual).
  taxasValor: number;
  lucro: number;
  createdAt: string;
};

type VendaShopeeDb = Prisma.VendaShopeeGetPayload<{ include: { produto: true } }>;

function toVendaShopee(v: VendaShopeeDb): VendaShopee {
  const valorVenda = Number(v.valorVenda);
  const custoTotal = Number(v.custoTotal);
  const comissaoPct = Number(v.comissaoPct);
  const fretePct = Number(v.fretePct);
  const adsPct = Number(v.adsPct);
  const taxaFixa = Number(v.taxaFixa);
  const taxasValor =
    Math.round(valorVenda * ((comissaoPct + fretePct + adsPct) / 100) * 100) / 100 + taxaFixa;
  const lucro = Math.round((valorVenda - custoTotal - taxasValor) * 100) / 100;

  return {
    id: v.id,
    produtoId: v.produtoId,
    produtoNome: v.produto.nome,
    combinacao: v.combinacao,
    quantidade: v.quantidade,
    valorVenda,
    custoTotal,
    comissaoPct,
    fretePct,
    adsPct,
    taxaFixa,
    taxasValor,
    lucro,
    createdAt: v.createdAt.toISOString(),
  };
}

export async function getVendasShopee(): Promise<VendaShopee[]> {
  const vendas = await prisma.vendaShopee.findMany({
    include: { produto: true },
    orderBy: { createdAt: "desc" },
  });
  return vendas.map(toVendaShopee);
}

// Margens efetivas de um produto: override do produto quando preenchido,
// senão o default global de ConfiguracaoLoja, senão 0 — mesmo padrão
// substitutivo de precoEfetivo/custoEfetivo (não soma, escolhe uma fonte).
export async function margensShopeeDoProduto(produtoId: string) {
  const [produto, config] = await Promise.all([
    prisma.produto.findUnique({ where: { id: produtoId } }),
    getConfiguracaoLoja(),
  ]);
  if (!produto) throw new ErroDeNegocio("Produto não encontrado.", 404);

  return {
    comissaoPct: Number(produto.shopeeComissaoPct ?? config.shopeeComissaoPct ?? 0),
    fretePct: Number(produto.shopeeFretePct ?? config.shopeeFretePct ?? 0),
    adsPct: Number(produto.shopeeAdsPct ?? config.shopeeAdsPct ?? 0),
    taxaFixa: Number(produto.shopeeTaxaFixa ?? config.shopeeTaxaFixa ?? 0),
  };
}

export type DadosVendaShopee = {
  produtoId: string;
  combinacao?: string | null;
  quantidade: number;
  valorVenda: number;
  // Margens explícitas (o form manda o valor pré-preenchido, editável). Sem
  // isso, resolve pelo default do produto/loja.
  comissaoPct?: number;
  fretePct?: number;
  adsPct?: number;
  taxaFixa?: number;
};

function validar(dados: Partial<DadosVendaShopee>) {
  if (dados.quantidade !== undefined && (!Number.isInteger(dados.quantidade) || dados.quantidade < 1)) {
    throw new ErroDeNegocio("A quantidade precisa ser um número inteiro maior que zero.");
  }
  if (dados.valorVenda !== undefined && !(dados.valorVenda > 0)) {
    throw new ErroDeNegocio("Informe o valor vendido, maior que zero.");
  }
  for (const [campo, valor] of [
    ["comissaoPct", dados.comissaoPct],
    ["fretePct", dados.fretePct],
    ["adsPct", dados.adsPct],
  ] as const) {
    if (valor !== undefined && (valor < 0 || valor > 100)) {
      throw new ErroDeNegocio(`${campo} precisa estar entre 0 e 100.`);
    }
  }
  if (dados.taxaFixa !== undefined && dados.taxaFixa < 0) {
    throw new ErroDeNegocio("A taxa fixa não pode ser negativa.");
  }
}

// Custo de material do produto pra uma combinação (ou custo base, sem
// variação escolhida) — mesma função usada no admin do produto.
async function custoDoProduto(produtoId: string, combinacao: string | null | undefined) {
  const produto = await prisma.produto.findUnique({
    where: { id: produtoId },
    include: { materiais: true, variacoes: true },
  });
  if (!produto) throw new ErroDeNegocio("Produto não encontrado.", 404);

  const custoTotalProduto = produto.materiais.reduce(
    (soma, m) => soma + Number(m.quantidade) * Number(m.custoUnitario),
    0
  );

  if (!combinacao) return custoTotalProduto;

  // combinacao vem como "Tipo:Valor|Tipo:Valor" — reconstrói as seleções
  // pra reaproveitar custoEfetivo, que espera um Record<tipo, valor>.
  const selecoes: Record<string, string> = {};
  for (const par of combinacao.split("|")) {
    const [tipo, valor] = par.split(":");
    if (tipo && valor) selecoes[tipo] = valor;
  }

  return custoEfetivo(
    {
      custoTotal: custoTotalProduto,
      variacoes: produto.variacoes.map((v) => ({
        tipo: v.tipo,
        custosValores: normalizarPrecosValores(v.custosValores),
      })),
    },
    selecoes
  );
}

export async function criarVendaShopee(dados: DadosVendaShopee): Promise<VendaShopee> {
  if (!dados.produtoId || dados.quantidade === undefined || dados.valorVenda === undefined) {
    throw new ErroDeNegocio("Informe produto, quantidade e valor vendido.");
  }
  validar(dados);

  const custoUnitario = await custoDoProduto(dados.produtoId, dados.combinacao);
  const margensPadrao = await margensShopeeDoProduto(dados.produtoId);

  const venda = await prisma.vendaShopee.create({
    data: {
      produtoId: dados.produtoId,
      combinacao: dados.combinacao || null,
      quantidade: dados.quantidade,
      valorVenda: dados.valorVenda,
      custoTotal: Math.round(custoUnitario * dados.quantidade * 100) / 100,
      comissaoPct: dados.comissaoPct ?? margensPadrao.comissaoPct,
      fretePct: dados.fretePct ?? margensPadrao.fretePct,
      adsPct: dados.adsPct ?? margensPadrao.adsPct,
      taxaFixa: dados.taxaFixa ?? margensPadrao.taxaFixa,
    },
    include: { produto: true },
  });
  return toVendaShopee(venda);
}

// Edição manual: todo campo é opcional e sobrescreve só o que foi mandado —
// inclusive custoTotal e as margens, pra permitir corrigir um lançamento
// errado sem recalcular tudo de novo (comportamento pedido: CRUD completo).
export async function atualizarVendaShopee(
  id: string,
  dados: Partial<DadosVendaShopee> & { custoTotal?: number }
): Promise<VendaShopee> {
  const atual = await prisma.vendaShopee.findUnique({ where: { id } });
  if (!atual) throw new ErroDeNegocio("Venda não encontrada.", 404);
  validar(dados);

  if (dados.custoTotal !== undefined && dados.custoTotal < 0) {
    throw new ErroDeNegocio("O custo não pode ser negativo.");
  }

  const venda = await prisma.vendaShopee.update({
    where: { id },
    data: {
      combinacao: dados.combinacao !== undefined ? dados.combinacao || null : undefined,
      quantidade: dados.quantidade,
      valorVenda: dados.valorVenda,
      custoTotal: dados.custoTotal,
      comissaoPct: dados.comissaoPct,
      fretePct: dados.fretePct,
      adsPct: dados.adsPct,
      taxaFixa: dados.taxaFixa,
    },
    include: { produto: true },
  });
  return toVendaShopee(venda);
}

export async function excluirVendaShopee(id: string): Promise<void> {
  const atual = await prisma.vendaShopee.findUnique({ where: { id } });
  if (!atual) throw new ErroDeNegocio("Venda não encontrada.", 404);
  await prisma.vendaShopee.delete({ where: { id } });
}
