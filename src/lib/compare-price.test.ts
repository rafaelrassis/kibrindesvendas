import { describe, it, expect } from "vitest";
import { compararPreco, formatarPreco } from "./compare-price";

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
