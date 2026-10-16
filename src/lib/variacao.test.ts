import { describe, expect, it } from "vitest";
import { variacaoTexto } from "./variacao";

describe("variacaoTexto", () => {
  it("alta e queda", () => {
    expect(variacaoTexto(120, 100)).toBe("+20% vs. semana anterior");
    expect(variacaoTexto(50, 100)).toBe("−50% vs. semana anterior");
  });
  it("sem base anterior", () => {
    expect(variacaoTexto(5, 0)).toBe("novo");
    expect(variacaoTexto(0, 0)).toBe("sem mudança");
  });
  it("igual", () => {
    expect(variacaoTexto(100, 100)).toBe("sem mudança");
  });
});
