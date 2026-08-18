import { describe, it, expect, vi, afterEach } from "vitest";
import { calcularFrete, cotarFreteMelhorEnvio, formatarCep, normalizarCep } from "./frete";

describe("calcularFrete", () => {
  it("cobra o menor valor pra SP, que é a origem da loja", () => {
    const frete = calcularFrete("SP");
    expect(frete.valor).toBe(9.9);
    expect(frete.prazoDias).toBe(2);
  });

  it("cobra mais caro e demora mais pra região Norte", () => {
    const sp = calcularFrete("SP");
    const norte = calcularFrete("AM");
    expect(norte.valor).toBeGreaterThan(sp.valor);
    expect(norte.prazoDias).toBeGreaterThan(sp.prazoDias);
  });

  it("aceita a UF em minúsculo e com espaços", () => {
    expect(calcularFrete(" sp ")).toEqual(calcularFrete("SP"));
  });

  it("cai na faixa mais cara quando a UF é desconhecida, em vez de sair de graça", () => {
    expect(calcularFrete("XX")).toEqual(calcularFrete("AM"));
  });

  it("nunca fica mais barato que SP, em nenhuma região", () => {
    const spValor = calcularFrete("SP").valor;
    for (const uf of ["RJ", "MG", "PR", "RS", "BA", "PE", "AM", "PA"]) {
      expect(calcularFrete(uf).valor).toBeGreaterThanOrEqual(spValor);
    }
  });
});

describe("normalizarCep", () => {
  it("tira a máscara e devolve só os 8 dígitos", () => {
    expect(normalizarCep("01310-100")).toBe("01310100");
    expect(normalizarCep("01310100")).toBe("01310100");
  });

  it("devolve null quando não são 8 dígitos", () => {
    expect(normalizarCep("1234")).toBeNull();
    expect(normalizarCep("013101000")).toBeNull();
    expect(normalizarCep("")).toBeNull();
  });
});

describe("formatarCep", () => {
  it("põe o hífen no lugar certo", () => {
    expect(formatarCep("01310100")).toBe("01310-100");
  });

  it("devolve o valor original quando não dá pra formatar", () => {
    expect(formatarCep("1234")).toBe("1234");
  });
});

describe("cotarFreteMelhorEnvio", () => {
  const pacote = { pesoGramas: 300, alturaCm: 4, larguraCm: 11, comprimentoCm: 16 };

  function respostaCom(servicos: unknown) {
    return {
      ok: true,
      json: async () => servicos,
    } as unknown as Response;
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fica com a opção mais barata entre as que voltaram", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        respostaCom([
          { id: 2, name: "SEDEX", price: "42.10", delivery_time: 2, company: { name: "Correios" } },
          { id: 1, name: "PAC", price: "23.50", delivery_time: 7, company: { name: "Correios" } },
        ])
      )
    );

    expect(await cotarFreteMelhorEnvio("token", "01310100", "60000000", pacote)).toEqual({
      valor: 23.5,
      prazoDias: 7,
    });
  });

  it("ignora serviços com erro (transportadora que não atende a rota)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        respostaCom([
          { id: 1, name: "PAC", price: "9.90", delivery_time: 5, company: { name: "X" }, error: "Rota não atendida" },
          { id: 2, name: "SEDEX", price: "42.10", delivery_time: 2, company: { name: "Correios" } },
        ])
      )
    );

    expect(await cotarFreteMelhorEnvio("token", "01310100", "60000000", pacote)).toEqual({
      valor: 42.1,
      prazoDias: 2,
    });
  });

  it("manda o pacote em centímetros e quilos e respeita a dimensão mínima dos Correios", async () => {
    let enviado: { products: { width: number; height: number; length: number; weight: number }[] } | null =
      null;
    vi.stubGlobal("fetch", async (_url: string, init: { body: string }) => {
      enviado = JSON.parse(init.body);
      return respostaCom([
        { id: 1, name: "PAC", price: "20.00", delivery_time: 5, company: { name: "Correios" } },
      ]);
    });

    await cotarFreteMelhorEnvio("token", "01310100", "60000000", {
      pesoGramas: 250,
      alturaCm: 1,
      larguraCm: 5,
      comprimentoCm: 8,
    });

    expect(enviado!.products[0]).toMatchObject({
      height: 2,
      width: 11,
      length: 16,
      weight: 0.25,
    });
  });

  it("devolve null quando a API responde erro, pra chamada cair na estimativa", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false }) as Response));
    expect(await cotarFreteMelhorEnvio("token", "01310100", "60000000", pacote)).toBeNull();
  });

  it("devolve null quando a rede falha ou estoura o timeout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("timeout");
      })
    );
    expect(await cotarFreteMelhorEnvio("token", "01310100", "60000000", pacote)).toBeNull();
  });

  it("devolve null quando nenhuma opção sobrou", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respostaCom([])));
    expect(await cotarFreteMelhorEnvio("token", "01310100", "60000000", pacote)).toBeNull();
  });
});
