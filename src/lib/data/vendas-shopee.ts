import "server-only";
import { prisma } from "@/lib/prisma";
import { custoEfetivo, custoComumMateriais } from "@/lib/estoque-variacao";
import { getConfiguracaoLoja } from "./configuracao";
import type { CampoMargemShopee } from "./configuracao";
import { normalizarPrecosValores } from "./produtos";
import { ErroDeNegocio } from "./erros";
import type { Prisma } from "@prisma/client";

// Snapshot de um campo do template aplicado numa venda específica — nome,
// tipo e sinal congelados no lançamento, imutáveis a mudanças posteriores no
// template (ConfiguracaoLoja.camposMargemShopee).
export type ValorMargemShopee = {
  nome: string;
  tipo: "percentual" | "valor";
  sinal: "soma" | "subtrai";
  valor: number;
};

export type VendaShopee = {
  id: string;
  produtoId: string;
  produtoNome: string;
  combinacao: string | null;
  quantidade: number;
  valorVenda: number;
  custoTotal: number;
  valoresShopee: ValorMargemShopee[];
  // Derivados — não guardados no banco, calculados na leitura a partir do
  // snapshot acima (nunca recalculam custo/margem do produto atual).
  taxasValor: number;
  lucro: number;
  createdAt: string;
};

type VendaShopeeDb = Prisma.VendaShopeeGetPayload<{ include: { produto: true } }>;

// Valor em R$ que um campo representa nesta venda: % sobre o valor vendido,
// ou o próprio valor fixo.
function valorCalculadoDoCampo(campo: ValorMargemShopee, valorVenda: number): number {
  return campo.tipo === "percentual" ? valorVenda * (campo.valor / 100) : campo.valor;
}

function toVendaShopee(v: VendaShopeeDb): VendaShopee {
  const valorVenda = Number(v.valorVenda);
  const custoTotal = Number(v.custoTotal);
  const valoresShopee = (v.valoresShopee as ValorMargemShopee[]) ?? [];

  let taxasValor = 0;
  let ajuste = 0;
  for (const campo of valoresShopee) {
    const valorCalculado = valorCalculadoDoCampo(campo, valorVenda);
    if (campo.sinal === "subtrai") {
      taxasValor += valorCalculado;
      ajuste -= valorCalculado;
    } else {
      ajuste += valorCalculado;
    }
  }
  taxasValor = Math.round(taxasValor * 100) / 100;
  const lucro = Math.round((valorVenda - custoTotal + ajuste) * 100) / 100;

  return {
    id: v.id,
    produtoId: v.produtoId,
    produtoNome: v.produto.nome,
    combinacao: v.combinacao,
    quantidade: v.quantidade,
    valorVenda,
    custoTotal,
    valoresShopee,
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

// Template atual pra pré-preencher o form de lançamento — cada campo
// entra com o valorPadrao configurado (ou 0, se em branco).
export async function templateValoresShopee(): Promise<ValorMargemShopee[]> {
  const config = await getConfiguracaoLoja();
  return config.camposMargemShopee.map((c: CampoMargemShopee) => ({
    nome: c.nome,
    tipo: c.tipo,
    sinal: c.sinal,
    valor: c.valorPadrao ?? 0,
  }));
}

export type DadosVendaShopee = {
  produtoId: string;
  combinacao?: string | null;
  quantidade: number;
  valorVenda: number;
  // Snapshot explícito (o form manda os valores pré-preenchidos pelo
  // template, editáveis nesta venda). Sem isso, usa o template atual.
  valoresShopee?: ValorMargemShopee[];
};

function validarValoresShopee(valores: ValorMargemShopee[]) {
  for (const campo of valores) {
    if (!campo.nome?.trim()) {
      throw new ErroDeNegocio("Todo campo de margem precisa de um nome.");
    }
    if (campo.tipo !== "percentual" && campo.tipo !== "valor") {
      throw new ErroDeNegocio(`Tipo inválido em "${campo.nome}".`);
    }
    if (campo.sinal !== "soma" && campo.sinal !== "subtrai") {
      throw new ErroDeNegocio(`Sinal inválido em "${campo.nome}".`);
    }
    if (!Number.isFinite(campo.valor) || campo.valor < 0) {
      throw new ErroDeNegocio(`Valor inválido em "${campo.nome}".`);
    }
    if (campo.tipo === "percentual" && campo.valor > 100) {
      throw new ErroDeNegocio(`"${campo.nome}" é percentual — não pode passar de 100.`);
    }
  }
}

function validar(dados: Partial<DadosVendaShopee>) {
  if (dados.quantidade !== undefined && (!Number.isInteger(dados.quantidade) || dados.quantidade < 1)) {
    throw new ErroDeNegocio("A quantidade precisa ser um número inteiro maior que zero.");
  }
  if (dados.valorVenda !== undefined && !(dados.valorVenda > 0)) {
    throw new ErroDeNegocio("Informe o valor vendido, maior que zero.");
  }
  if (dados.valoresShopee !== undefined) {
    validarValoresShopee(dados.valoresShopee);
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

  const materiais = produto.materiais.map((m) => ({
    quantidade: Number(m.quantidade),
    custoUnitario: Number(m.custoUnitario),
    variacaoValor: m.variacaoValor,
  }));

  if (!combinacao) return custoComumMateriais(materiais);

  // combinacao vem como "Tipo:Valor|Tipo:Valor" — reconstrói as seleções
  // pra reaproveitar custoEfetivo, que espera um Record<tipo, valor>.
  const selecoes: Record<string, string> = {};
  for (const par of combinacao.split("|")) {
    const [tipo, valor] = par.split(":");
    if (tipo && valor) selecoes[tipo] = valor;
  }

  return custoEfetivo(
    {
      materiais,
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
  const valoresShopee = dados.valoresShopee ?? (await templateValoresShopee());

  const venda = await prisma.vendaShopee.create({
    data: {
      produtoId: dados.produtoId,
      combinacao: dados.combinacao || null,
      quantidade: dados.quantidade,
      valorVenda: dados.valorVenda,
      custoTotal: Math.round(custoUnitario * dados.quantidade * 100) / 100,
      valoresShopee: valoresShopee as unknown as Prisma.InputJsonValue,
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
      valoresShopee: dados.valoresShopee as unknown as Prisma.InputJsonValue | undefined,
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
