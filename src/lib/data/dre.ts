import "server-only";
import { prisma } from "@/lib/prisma";
import {
  montarDRE,
  periodoDoMes,
  type CanalDRE,
  type DRE,
  type PedidoParaDRE,
  type VendaShopeeParaDRE,
} from "@/lib/dre";
import { getConfiguracaoLoja } from "./configuracao";
import { STATUS_DE_VENDA } from "./dashboard";
import { custoUnitarioDoProduto } from "./custo-produto";
import { listarDespesas, type Despesa } from "./despesas";
import { toVendaShopee } from "./vendas-shopee";

export type DadosDRE = {
  mes: string;
  rotulo: string;
  canal: CanalDRE;
  dre: DRE;
  despesas: Despesa[];
  // Itens de pedido anteriores ao snapshot de custo: usam o custo ATUAL do
  // produto, então mudar o cadastro ainda mexe nesses meses.
  itensSemSnapshotDeCusto: number;
};

// Regime de competência: o pedido conta no mês em que foi criado. Pedido
// simulado (sem cobrança real) fica de fora, senão inflaria a receita.
export async function getDRE(mesBruto: string | undefined, canal: CanalDRE): Promise<DadosDRE> {
  const { mes, rotulo, inicio, fim } = periodoDoMes(mesBruto);
  const incluiSite = canal !== "shopee";
  const incluiShopee = canal !== "site";

  const [config, pedidosDb, vendasShopeeDb, despesas] = await Promise.all([
    getConfiguracaoLoja(),
    incluiSite
      ? prisma.pedido.findMany({
          where: {
            createdAt: { gte: inicio, lt: fim },
            status: { in: STATUS_DE_VENDA },
            pagamentoMock: false,
          },
          select: {
            status: true,
            total: true,
            desconto: true,
            frete: true,
            valorReembolsado: true,
            freteCusto: true,
            taxaGatewayPct: true,
            itens: {
              select: {
                quantidade: true,
                precoUnitario: true,
                custoUnitario: true,
                variacaoEscolhida: true,
                produto: { select: { materiais: true, variacoes: true } },
              },
            },
          },
        })
      : Promise.resolve([]),
    incluiShopee
      ? prisma.vendaShopee.findMany({
          where: { createdAt: { gte: inicio, lt: fim } },
          include: { produto: true },
        })
      : Promise.resolve([]),
    // Despesa não é de canal nenhum: só entra na visão consolidada.
    canal === "todos" ? listarDespesas(inicio, fim) : Promise.resolve([]),
  ]);

  let itensSemSnapshotDeCusto = 0;

  const pedidos: PedidoParaDRE[] = pedidosDb.map((p) => {
    let produtos = 0;
    let custoMaterial = 0;
    for (const item of p.itens) {
      produtos += Number(item.precoUnitario) * item.quantidade;
      let custoUnitario: number;
      if (item.custoUnitario != null) {
        custoUnitario = Number(item.custoUnitario);
      } else {
        itensSemSnapshotDeCusto++;
        custoUnitario = custoUnitarioDoProduto(
          item.produto,
          (item.variacaoEscolhida as Record<string, string> | null) ?? {}
        );
      }
      custoMaterial += custoUnitario * item.quantidade;
    }
    // Devolvido sem reembolso lançado: assume o pedido inteiro.
    const reembolsado =
      p.valorReembolsado != null
        ? Number(p.valorReembolsado)
        : p.status === "DEVOLVIDO"
          ? Number(p.total)
          : 0;
    return {
      produtos,
      desconto: Number(p.desconto),
      frete: Number(p.frete),
      reembolsado,
      custoMaterial,
      freteCusto: p.freteCusto != null ? Number(p.freteCusto) : null,
      taxaGatewayPct: Number(p.taxaGatewayPct ?? config.taxaGatewayPct ?? 0),
    };
  });

  const shopee: VendaShopeeParaDRE[] = vendasShopeeDb.map((v) => {
    const venda = toVendaShopee(v);
    return {
      valorVenda: venda.valorVenda,
      custoTotal: venda.custoTotal,
      // lucro = valorVenda - custo + ajuste (ver toVendaShopee).
      ajuste: venda.lucro - (venda.valorVenda - venda.custoTotal),
    };
  });

  return {
    mes,
    rotulo,
    canal,
    dre: montarDRE({ pedidos, shopee, despesas }),
    despesas,
    itensSemSnapshotDeCusto,
  };
}
