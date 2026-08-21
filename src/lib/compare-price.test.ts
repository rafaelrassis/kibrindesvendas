import { describe, it, expect } from "vitest";
import { calcularDesconto, compararPreco, formatarPreco } from "./compare-price";

describe("compararPreco", () => {
  it("mostra economia quando o preço do site é menor", () => {
    const r = compararPreco(100, 80, true);
    expect(r.mostrar).toBe(true);
    if (r.mostrar) {
      expect(r.economia).toBe(20);
      expect(r.percentual).toBe(20);
    }
  });

  it("não mostra quando o preço do site é igual", () => {
    expect(compararPreco(100, 100, true).mostrar).toBe(false);
  });

  it("não mostra quando o preço do site é maior", () => {
    expect(compararPreco(100, 120, true).mostrar).toBe(false);
  });

  it("não mostra quando o produto não é vendido na Shopee, mesmo com preço menor", () => {
    expect(compararPreco(100, 80, false).mostrar).toBe(false);
  });

  it("arredonda o percentual pra inteiro mais próximo", () => {
    const r = compararPreco(30, 20, true);
    expect(r.mostrar).toBe(true);
    if (r.mostrar) expect(r.percentual).toBe(33);
  });
});

describe("formatarPreco", () => {
  it("formata em reais com vírgula decimal", () => {
    expect(formatarPreco(24.9)).toBe("R$ 24,90");
    expect(formatarPreco(1000)).toBe("R$ 1000,00");
  });
});

describe("calcularDesconto", () => {
  it("mostra desconto quando precoOriginal é maior que preco", () => {
    const r = calcularDesconto(5, 10);
    expect(r.ativo).toBe(true);
    if (r.ativo) expect(r.percentual).toBe(50);
  });

  it("não mostra quando precoOriginal é null", () => {
    expect(calcularDesconto(5, null).ativo).toBe(false);
  });

  it("não mostra quando precoOriginal é undefined", () => {
    expect(calcularDesconto(5, undefined).ativo).toBe(false);
  });

  it("não mostra quando precoOriginal é igual ao preco", () => {
    expect(calcularDesconto(10, 10).ativo).toBe(false);
  });

  it("não mostra quando precoOriginal é menor que o preco (cadastro errado)", () => {
    expect(calcularDesconto(10, 8).ativo).toBe(false);
  });

  it("arredonda o percentual pra inteiro mais próximo", () => {
    const r = calcularDesconto(20, 30);
    expect(r.ativo).toBe(true);
    if (r.ativo) expect(r.percentual).toBe(33);
  });
});
