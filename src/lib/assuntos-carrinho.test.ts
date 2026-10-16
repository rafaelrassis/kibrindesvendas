import { describe, expect, it } from "vitest";
import {
  assuntoDoLembrete,
  leituraAB,
  novosResultadosAB,
  varianteDoAssunto,
  varianteDoCupom,
} from "./assuntos-carrinho";

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

describe("varianteDoCupom", () => {
  it("é estável e divide os grupos", () => {
    expect(varianteDoCupom("abc")).toBe(varianteDoCupom("abc"));
    const ids = Array.from({ length: 60 }, (_, i) => `usuario-${i}`);
    expect(new Set(ids.map(varianteDoCupom))).toEqual(new Set(["A", "B"]));
  });
});

describe("leituraAB", () => {
  it("amostra pequena: não aponta vencedor", () => {
    const r = leituraAB({ enviados: 10, recuperados: 5 }, { enviados: 10, recuperados: 1 });
    expect(r.significativo).toBe(false);
    expect(r.texto).toMatch(/cedo/i);
  });
  it("diferença grande com amostra boa: significativo", () => {
    const r = leituraAB({ enviados: 200, recuperados: 40 }, { enviados: 200, recuperados: 15 });
    expect(r.significativo).toBe(true);
    expect(r.texto).toMatch(/^A /);
  });
  it("diferença pequena: dentro do acaso", () => {
    const r = leituraAB({ enviados: 100, recuperados: 10 }, { enviados: 100, recuperados: 12 });
    expect(r.significativo).toBe(false);
    expect(r.texto).toMatch(/acaso/);
  });
});

describe("novosResultadosAB", () => {
  const sig = (lider: "A" | "B") => ({ texto: "x", significativo: true, lider });
  const nao = { texto: "y", significativo: false } as const;

  it("avisa só o que é novo e guarda o conjunto atual", () => {
    const r = novosResultadosAB({ desconto: sig("B"), assunto24h: nao }, []);
    expect(r.novos.map((n) => n.chave)).toEqual(["desconto"]);
    expect(r.atuais).toEqual(["desconto:B"]);
  });
  it("não repete o que já foi avisado", () => {
    const r = novosResultadosAB({ desconto: sig("B") }, ["desconto:B"]);
    expect(r.novos).toEqual([]);
  });
  it("avisa de novo se o líder mudou", () => {
    const r = novosResultadosAB({ desconto: sig("A") }, ["desconto:B"]);
    expect(r.novos).toHaveLength(1);
  });
});
