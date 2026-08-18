import { describe, it, expect } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  it("remove acentos", () => {
    expect(slugify("Ímãs de Geladeira")).toBe("imas-de-geladeira");
  });

  it("troca espaços por hífen e vira minúsculo", () => {
    expect(slugify("Canecas Personalizadas")).toBe("canecas-personalizadas");
  });

  it("remove pontuação", () => {
    expect(slugify("Presentes & Cia!")).toBe("presentes-cia");
  });

  it("não deixa hífen sobrando nas pontas", () => {
    expect(slugify("  Moletons  ")).toBe("moletons");
  });

  it("colapsa múltiplos separadores em um só hífen", () => {
    expect(slugify("Camisetas   e   Regatas")).toBe("camisetas-e-regatas");
  });
});
