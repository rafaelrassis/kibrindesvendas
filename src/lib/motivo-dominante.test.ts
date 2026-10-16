import { describe, expect, it } from "vitest";
import { destaqueDoEmail, motivoDominante } from "./motivo-dominante";

describe("motivoDominante", () => {
  it("poucas respostas: nada", () => {
    expect(motivoDominante({ frete: 5 })).toBeNull();
  });
  it("motivo com folga vence", () => {
    expect(motivoDominante({ frete: 12, preco: 4, duvida: 2 })).toBe("frete");
  });
  it("empate difuso: nada", () => {
    expect(motivoDominante({ frete: 5, preco: 5, duvida: 5, outro: 5 })).toBeNull();
  });
  it("'outro' nunca vira destaque", () => {
    expect(motivoDominante({ outro: 20, frete: 1 })).toBeNull();
  });
});

describe("destaqueDoEmail", () => {
  it("frete sem limite configurado não inventa promessa", () => {
    expect(destaqueDoEmail("frete", null)).toBeNull();
    expect(destaqueDoEmail("frete", 150)).toMatch(/Frete grátis/);
  });
  it("sem motivo, sem destaque", () => {
    expect(destaqueDoEmail(null, 150)).toBeNull();
  });
});
