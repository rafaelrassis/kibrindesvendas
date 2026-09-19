import { describe, expect, it } from "vitest";
import { canalValido, montarDRE, periodoDoMes, ultimosMeses } from "./dre";

const pedido = {
  produtos: 100,
  desconto: 10,
  frete: 20,
  reembolsado: 0,
  custoMaterial: 30,
  freteCusto: 18,
  taxaGatewayPct: 5,
};

describe("montarDRE", () => {
  it("monta as linhas na ordem do demonstrativo", () => {
    const d = montarDRE({
      pedidos: [pedido],
      shopee: [{ valorVenda: 50, custoTotal: 15, ajuste: -10 }],
      despesas: [{ categoria: "Embalagem", valor: 5 }],
    });
    expect(d.receitaBruta).toBe(170); // 100 + 50 + 20
    expect(d.receitaLiquida).toBe(160); // - cupom 10
    expect(d.custoMaterial).toBe(45);
    expect(d.lucroBruto).toBe(115);
    expect(d.taxasGateway).toBe(5.5); // 5% de (100 - 10 + 20)
    expect(d.taxasShopee).toBe(10);
    expect(d.fretePago).toBe(18);
    expect(d.resultado).toBe(76.5); // 115 - 5,5 - 10 - 18 - 5
  });

  it("subtrai reembolso da receita", () => {
    const d = montarDRE({ pedidos: [{ ...pedido, reembolsado: 40 }], shopee: [], despesas: [] });
    expect(d.devolucoes).toBe(40);
    expect(d.receitaLiquida).toBe(70);
  });

  it("conta pedido sem frete informado em vez de tratar como zero em silêncio", () => {
    const d = montarDRE({
      pedidos: [pedido, { ...pedido, freteCusto: null }],
      shopee: [],
      despesas: [],
    });
    expect(d.pedidosSemFreteCusto).toBe(1);
    expect(d.fretePago).toBe(18);
  });

  it("não desalinha centavos", () => {
    const d = montarDRE({
      pedidos: [
        { ...pedido, produtos: 39.9, desconto: 0, frete: 0, taxaGatewayPct: 0 },
        { ...pedido, produtos: 16.9, desconto: 0, frete: 0, taxaGatewayPct: 0 },
      ],
      shopee: [],
      despesas: [],
    });
    expect(d.receitaSite).toBe(56.8);
  });

  it("período vazio dá tudo zero e margem 0", () => {
    const d = montarDRE({ pedidos: [], shopee: [], despesas: [] });
    expect(d.resultado).toBe(0);
    expect(d.margemPct).toBe(0);
  });

  it("agrupa despesas por categoria, maior primeiro", () => {
    const d = montarDRE({
      pedidos: [],
      shopee: [],
      despesas: [
        { categoria: "Marketing", valor: 10 },
        { categoria: "Embalagem", valor: 30 },
        { categoria: "Marketing", valor: 5 },
      ],
    });
    expect(d.despesasPorCategoria).toEqual([
      { categoria: "Embalagem", valor: 30 },
      { categoria: "Marketing", valor: 15 },
    ]);
  });
});

describe("periodoDoMes", () => {
  it("vai de 1º dia a 1º dia do mês seguinte, em Brasília", () => {
    const p = periodoDoMes("2026-09");
    expect(p.inicio.toISOString()).toBe("2026-09-01T03:00:00.000Z");
    expect(p.fim.toISOString()).toBe("2026-10-01T03:00:00.000Z");
    expect(p.rotulo).toBe("Setembro/2026");
  });

  it("dezembro vira janeiro do ano seguinte", () => {
    expect(periodoDoMes("2026-12").fim.toISOString()).toBe("2027-01-01T03:00:00.000Z");
  });

  it("valor inválido cai no mês atual", () => {
    const agora = Date.parse("2026-09-19T15:00:00Z");
    expect(periodoDoMes("2026-13", agora).mes).toBe("2026-09");
    expect(periodoDoMes(undefined, agora).mes).toBe("2026-09");
  });

  it("22h de 30/09 em Brasília ainda é setembro", () => {
    expect(periodoDoMes(undefined, Date.parse("2026-10-01T01:00:00Z")).mes).toBe("2026-09");
  });
});

describe("ultimosMeses", () => {
  it("atravessa a virada do ano", () => {
    const l = ultimosMeses(3, Date.parse("2026-01-15T12:00:00Z"));
    expect(l.map((m) => m.mes)).toEqual(["2026-01", "2025-12", "2025-11"]);
  });
});

describe("canalValido", () => {
  it("valor desconhecido vira todos", () => {
    expect(canalValido("xyz")).toBe("todos");
    expect(canalValido("site")).toBe("site");
  });
});
