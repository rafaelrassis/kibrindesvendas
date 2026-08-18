import { describe, it, expect } from "vitest";
import { calcularFrete, formatarCep, normalizarCep } from "./frete";

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
