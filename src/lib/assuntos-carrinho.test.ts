import { describe, expect, it } from "vitest";
import { assuntoDoLembrete, varianteDoAssunto } from "./assuntos-carrinho";

describe("varianteDoAssunto", () => {
  it("é estável para o mesmo usuário", () => {
    expect(varianteDoAssunto("cm123abc")).toBe(varianteDoAssunto("cm123abc"));
  });

  it("divide ids diferentes entre A e B", () => {
    const ids = Array.from({ length: 40 }, (_, i) => `usuario-${i}`);
    const variantes = new Set(ids.map(varianteDoAssunto));
    expect(variantes).toEqual(new Set(["A", "B"]));
  });
});

describe("assuntoDoLembrete", () => {
  it("as duas variantes do mesmo tipo têm assuntos diferentes", () => {
    expect(assuntoDoLembrete(1, "A")).not.toBe(assuntoDoLembrete(1, "B"));
    expect(assuntoDoLembrete(2, "A", 5)).not.toBe(assuntoDoLembrete(2, "B", 5));
  });

  it("o lembrete com cupom cita o percentual", () => {
    expect(assuntoDoLembrete(2, "A", 7)).toContain("7%");
    expect(assuntoDoLembrete(2, "B", 7)).toContain("7%");
  });
});
