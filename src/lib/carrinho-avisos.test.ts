import { describe, expect, it } from "vitest";
import { avisosDaLinha, faltaParaFreteGratis } from "./carrinho-avisos";
import type { Produto } from "./types";

function produto(parcial: Partial<Produto> = {}): Produto {
  return {
    preco: 50,
    variacoes: [],
    estoque: null,
    estoqueVariacoes: [],
    ...parcial,
  } as Produto;
}

const linha = { variacoesEscolhidas: {}, quantidade: 1 };

describe("avisosDaLinha", () => {
  it("produto sem controle de estoque e sem mudança de preço não avisa nada", () => {
    expect(avisosDaLinha(produto(), linha)).toEqual({
      esgotado: false,
      excede: null,
      estoqueBaixo: null,
      precoMudou: null,
      bloqueia: false,
    });
  });

  it("estoque zero está esgotado e bloqueia", () => {
    const a = avisosDaLinha(produto({ estoque: 0 }), linha);
    expect(a.esgotado).toBe(true);
    expect(a.bloqueia).toBe(true);
  });

  it("pedir mais do que há excede e bloqueia, dizendo quanto resta", () => {
    const a = avisosDaLinha(produto({ estoque: 3 }), { ...linha, quantidade: 5 });
    expect(a.excede).toBe(3);
    expect(a.bloqueia).toBe(true);
    expect(a.estoqueBaixo).toBeNull();
  });

  it("estoque baixo mas suficiente só avisa, sem bloquear", () => {
    const a = avisosDaLinha(produto({ estoque: 4 }), { ...linha, quantidade: 2 });
    expect(a.estoqueBaixo).toBe(4);
    expect(a.bloqueia).toBe(false);
  });

  it("estoque folgado não avisa", () => {
    expect(avisosDaLinha(produto({ estoque: 50 }), linha).estoqueBaixo).toBeNull();
  });

  it("usa o estoque da combinação quando o controle é por variação", () => {
    const p = produto({
      variacoes: [{ tipo: "Cor" } as Produto["variacoes"][number]],
      estoqueVariacoes: [{ combinacao: "Cor:Preta", estoque: 1 }] as Produto["estoqueVariacoes"],
    });
    expect(avisosDaLinha(p, { variacoesEscolhidas: { Cor: "Preta" }, quantidade: 2 }).excede).toBe(1);
    expect(avisosDaLinha(p, { variacoesEscolhidas: { Cor: "Azul" }, quantidade: 1 }).esgotado).toBe(true);
  });

  it("avisa quando o preço de hoje difere do visto ao adicionar", () => {
    const a = avisosDaLinha(produto({ preco: 60 }), { ...linha, precoAdicionado: 50 });
    expect(a.precoMudou).toEqual({ de: 50, para: 60 });
    expect(a.bloqueia).toBe(false);
  });

  it("diferença menor que 1 centavo não conta como mudança", () => {
    expect(avisosDaLinha(produto({ preco: 50 }), { ...linha, precoAdicionado: 50.004 }).precoMudou).toBeNull();
  });

  it("linha sem preço salvo (carrinho antigo) não avisa preço", () => {
    expect(avisosDaLinha(produto(), linha).precoMudou).toBeNull();
  });
});

describe("faltaParaFreteGratis", () => {
  it("sem limiar configurado, não há barra", () => {
    expect(faltaParaFreteGratis(40, null)).toBeNull();
  });
  it("abaixo do limiar devolve o que falta, em centavos exatos", () => {
    expect(faltaParaFreteGratis(89.9, 150)).toBe(60.1);
  });
  it("no limiar ou acima, não falta nada", () => {
    expect(faltaParaFreteGratis(150, 150)).toBeNull();
    expect(faltaParaFreteGratis(200, 150)).toBeNull();
  });
});
