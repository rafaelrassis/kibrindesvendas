import { describe, expect, it } from "vitest";
import { dimensaoEfetiva } from "./estoque-variacao";

const produtoBase = {
  pesoMiligramas: 300000,
  alturaMm: 40,
  larguraMm: 110,
  comprimentoMm: 160,
};

describe("dimensaoEfetiva", () => {
  it("sem seleção, usa as dimensões do produto", () => {
    const produto = { ...produtoBase, variacoes: [] };
    expect(dimensaoEfetiva(produto, {})).toMatchObject(produtoBase);
  });

  it("sem dimensoesValores cadastrado pro valor, usa as dimensões do produto", () => {
    const produto = {
      ...produtoBase,
      variacoes: [{ tipo: "Tamanho", dimensoesValores: { "9x6": { pesoMiligramas: 5000 } } }],
    };
    expect(dimensaoEfetiva(produto, { Tamanho: "7x5" })).toMatchObject(produtoBase);
  });

  it("substitui só o peso, herdando altura/largura/comprimento do produto", () => {
    const produto = {
      ...produtoBase,
      variacoes: [{ tipo: "Tamanho", dimensoesValores: { "7x5": { pesoMiligramas: 4500 } } }],
    };
    expect(dimensaoEfetiva(produto, { Tamanho: "7x5" })).toMatchObject({
      ...produtoBase,
      pesoMiligramas: 4500,
    });
  });

  it("substitui todos os campos quando o valor tem os quatro cadastrados", () => {
    const produto = {
      ...produtoBase,
      variacoes: [
        {
          tipo: "Tamanho",
          dimensoesValores: {
            "10x7": { pesoMiligramas: 6000, alturaMm: 0.4, larguraMm: 180, comprimentoMm: 250 },
          },
        },
      ],
    };
    expect(dimensaoEfetiva(produto, { Tamanho: "10x7" })).toMatchObject({
      pesoMiligramas: 6000,
      alturaMm: 0.4,
      larguraMm: 180,
      comprimentoMm: 250,
    });
  });

  it("usa a primeira variação com override aplicável, ignorando as demais", () => {
    const produto = {
      ...produtoBase,
      variacoes: [
        { tipo: "Cor", dimensoesValores: null },
        { tipo: "Tamanho", dimensoesValores: { "14x10": { pesoMiligramas: 9000 } } },
      ],
    };
    expect(
      dimensaoEfetiva(produto, { Cor: "Preta", Tamanho: "14x10" }).pesoMiligramas
    ).toBe(9000);
  });
});
