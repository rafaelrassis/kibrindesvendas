import { describe, expect, it } from "vitest";
import { SESSAO_VALIDA, tipoFunilValido } from "./funil";
import { motivoValido } from "./motivo-abandono";

describe("funil", () => {
  it("só aceita os tipos conhecidos", () => {
    expect(tipoFunilValido("carrinho_add")).toBe(true);
    expect(tipoFunilValido("qualquer")).toBe(false);
    expect(tipoFunilValido(undefined)).toBe(false);
  });
  it("sessão é um id simples", () => {
    expect(SESSAO_VALIDA.test("3f2b9c1e-8a4d-4c1b-9e7f-0a1b2c3d4e5f")).toBe(true);
    expect(SESSAO_VALIDA.test("x' OR 1=1")).toBe(false);
    expect(SESSAO_VALIDA.test("curto")).toBe(false);
  });
});

describe("motivo de abandono", () => {
  it("valida o enum", () => {
    expect(motivoValido("frete")).toBe(true);
    expect(motivoValido("hack")).toBe(false);
  });
});
