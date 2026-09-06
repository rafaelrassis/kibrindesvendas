import { describe, it, expect } from "vitest";
import {
  CLASSE_STATUS,
  COR_STATUS,
  LABEL_STATUS,
  STATUS_PEDIDO,
  labelStatus,
  podeSolicitarDevolucao,
  valorReembolsoValido,
} from "./status-pedido";

describe("labelStatus", () => {
  it("traduz os status conhecidos", () => {
    expect(labelStatus("AGUARDANDO_PAGAMENTO")).toBe("Aguardando pagamento");
    expect(labelStatus("EM_PRODUCAO")).toBe("Em produção");
  });

  it("devolve o próprio valor quando o status não está no mapa", () => {
    expect(labelStatus("STATUS_NOVO")).toBe("STATUS_NOVO");
  });

  it("tem rótulo, classe e cor pra todo status do fluxo", () => {
    for (const status of STATUS_PEDIDO) {
      expect(LABEL_STATUS[status]).toBeTruthy();
      expect(CLASSE_STATUS[status]).toBeTruthy();
      expect(COR_STATUS[status]).toBeTruthy();
    }
  });
});

describe("podeSolicitarDevolucao", () => {
  it("libera só depois de entregue", () => {
    expect(podeSolicitarDevolucao("ENTREGUE")).toBe(true);
  });

  it("bloqueia antes da entrega e depois de já pedida", () => {
    for (const status of ["AGUARDANDO_PAGAMENTO", "PAGO", "EM_PRODUCAO", "ENVIADO"]) {
      expect(podeSolicitarDevolucao(status)).toBe(false);
    }
    expect(podeSolicitarDevolucao("DEVOLUCAO_SOLICITADA")).toBe(false);
    expect(podeSolicitarDevolucao("DEVOLVIDO")).toBe(false);
    expect(podeSolicitarDevolucao("CANCELADO")).toBe(false);
  });
});

describe("valorReembolsoValido", () => {
  it("aceita um valor positivo que cabe no total", () => {
    expect(valorReembolsoValido(100, 0, 30)).toBe(true);
  });

  it("aceita reembolsos somados até bater exatamente o total", () => {
    expect(valorReembolsoValido(100, 60, 40)).toBe(true);
  });

  it("recusa valor zero ou negativo", () => {
    expect(valorReembolsoValido(100, 0, 0)).toBe(false);
    expect(valorReembolsoValido(100, 0, -10)).toBe(false);
  });

  it("recusa quando a soma ultrapassa o total já pago", () => {
    expect(valorReembolsoValido(100, 60, 41)).toBe(false);
    expect(valorReembolsoValido(100, 0, 100.01)).toBe(false);
  });

  it("recusa valor não numérico", () => {
    expect(valorReembolsoValido(100, 0, NaN)).toBe(false);
  });
});
