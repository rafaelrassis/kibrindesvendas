import { describe, expect, it } from "vitest";
import { atribuirRecuperacao } from "./recuperacao-carrinho";

const d = (dia: number, hora = 12) => new Date(Date.UTC(2026, 9, dia, hora));

describe("atribuirRecuperacao", () => {
  it("pedido depois do lembrete, dentro de 7 dias, é recuperado", () => {
    const r = atribuirRecuperacao(
      [{ id: "l1", usuarioId: "u1", enviadoEm: d(1) }],
      [{ usuarioId: "u1", total: 80, createdAt: d(3) }]
    );
    expect(r.get("l1")).toBe(80);
  });

  it("pedido antes do lembrete não conta", () => {
    const r = atribuirRecuperacao(
      [{ id: "l1", usuarioId: "u1", enviadoEm: d(5) }],
      [{ usuarioId: "u1", total: 80, createdAt: d(3) }]
    );
    expect(r.size).toBe(0);
  });

  it("pedido depois de 7 dias não conta", () => {
    const r = atribuirRecuperacao(
      [{ id: "l1", usuarioId: "u1", enviadoEm: d(1) }],
      [{ usuarioId: "u1", total: 80, createdAt: d(9) }]
    );
    expect(r.size).toBe(0);
  });

  it("pedido de outro cliente não conta", () => {
    const r = atribuirRecuperacao(
      [{ id: "l1", usuarioId: "u1", enviadoEm: d(1) }],
      [{ usuarioId: "u2", total: 80, createdAt: d(2) }]
    );
    expect(r.size).toBe(0);
  });

  it("com dois lembretes antes do pedido, só o mais recente leva o crédito", () => {
    const r = atribuirRecuperacao(
      [
        { id: "l1", usuarioId: "u1", enviadoEm: d(1) },
        { id: "l2", usuarioId: "u1", enviadoEm: d(3) },
      ],
      [{ usuarioId: "u1", total: 100, createdAt: d(4) }]
    );
    expect(r.get("l2")).toBe(100);
    expect(r.has("l1")).toBe(false);
  });

  it("não depende da ordem em que os lembretes chegam", () => {
    const r = atribuirRecuperacao(
      [
        { id: "l2", usuarioId: "u1", enviadoEm: d(3) },
        { id: "l1", usuarioId: "u1", enviadoEm: d(1) },
      ],
      [{ usuarioId: "u1", total: 100, createdAt: d(4) }]
    );
    expect(r.get("l2")).toBe(100);
  });

  it("soma dois pedidos atribuídos ao mesmo lembrete", () => {
    const r = atribuirRecuperacao(
      [{ id: "l1", usuarioId: "u1", enviadoEm: d(1) }],
      [
        { usuarioId: "u1", total: 40, createdAt: d(2) },
        { usuarioId: "u1", total: 60, createdAt: d(3) },
      ]
    );
    expect(r.get("l1")).toBe(100);
  });
});
