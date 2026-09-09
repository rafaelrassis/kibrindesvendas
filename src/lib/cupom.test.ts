import { describe, it, expect } from "vitest";
import {
  calcularDesconto,
  checarDisponibilidade,
  dataDeValidadeValida,
  fimDoDiaBrasilia,
  normalizarCodigo,
  paraValidoAte,
  type EstadoCupom,
} from "./cupom";

// Cupom saudável; cada teste muda só o campo que está sendo exercitado.
function cupom(ajustes: Partial<EstadoCupom> = {}): EstadoCupom {
  return {
    ativo: true,
    validoAte: null,
    usoMaximo: null,
    usos: 0,
    valorMinimoPedido: 0,
    produtoId: null,
    primeiraCompra: false,
    ...ajustes,
  };
}

describe("normalizarCodigo", () => {
  it("trata maiúsculas, minúsculas e espaços como o mesmo cupom", () => {
    expect(normalizarCodigo(" promo10 ")).toBe("PROMO10");
    expect(normalizarCodigo("PROMO10")).toBe("PROMO10");
  });
});

describe("calcularDesconto", () => {
  it("aplica o percentual sobre o valor do pedido", () => {
    expect(calcularDesconto("PERCENTUAL", 10, 100)).toBe(10);
  });

  it("aplica o valor fixo independente do tamanho do pedido", () => {
    expect(calcularDesconto("FIXO", 15, 100)).toBe(15);
  });

  it("nunca desconta mais do que o pedido vale", () => {
    expect(calcularDesconto("FIXO", 200, 100)).toBe(100);
    expect(calcularDesconto("PERCENTUAL", 100, 39.9)).toBe(39.9);
  });

  it("arredonda pra casa dos centavos", () => {
    expect(calcularDesconto("PERCENTUAL", 15, 39.9)).toBe(5.99);
  });

  it("incide sobre o total das unidades, não sobre uma só", () => {
    expect(calcularDesconto("PERCENTUAL", 10, 39.9 * 3)).toBe(11.97);
  });

  it("frete grátis não desconta nada do produto — só zera o frete, fora daqui", () => {
    expect(calcularDesconto("FRETE_GRATIS", 0, 100)).toBe(0);
    // mesmo que `valor` venha preenchido por engano, o tipo manda: nunca
    // desconta do subtotal do produto.
    expect(calcularDesconto("FRETE_GRATIS", 50, 100)).toBe(0);
  });
});

describe("paraValidoAte", () => {
  it("estica a data do formulário até o fim do dia no horário de Brasília", () => {
    // 23:59:59.999 em UTC-3 é 02:59:59.999 do dia seguinte em UTC.
    expect(paraValidoAte("2026-08-25")?.toISOString()).toBe("2026-08-26T02:59:59.999Z");
    expect(fimDoDiaBrasilia("2026-08-25").toISOString()).toBe("2026-08-26T02:59:59.999Z");
  });

  it("não reinterpreta um valor que já veio com horário", () => {
    expect(paraValidoAte("2026-08-25T12:00:00.000Z")?.toISOString()).toBe(
      "2026-08-25T12:00:00.000Z"
    );
  });

  it("devolve null pra data ausente ou em branco", () => {
    expect(paraValidoAte(null)).toBeNull();
    expect(paraValidoAte(undefined)).toBeNull();
    expect(paraValidoAte("   ")).toBeNull();
  });

  it("devolve null pra texto que não é data, e o validador reprova", () => {
    expect(paraValidoAte("amanhã")).toBeNull();
    expect(dataDeValidadeValida("amanhã")).toBe(false);
    expect(dataDeValidadeValida("2026-08-25")).toBe(true);
    expect(dataDeValidadeValida(null)).toBe(true);
  });
});

describe("checarDisponibilidade", () => {
  it("libera o cupom saudável", () => {
    expect(checarDisponibilidade(cupom(), 100)).toBeNull();
  });

  it("recusa cupom inativo com 404, como se não existisse", () => {
    expect(checarDisponibilidade(cupom({ ativo: false }), 100)).toEqual({
      mensagem: "Cupom inválido ou inativo.",
      status: 404,
    });
  });

  it("vale até 23:59:59 do dia escolhido, no horário de Brasília", () => {
    const validoAte = paraValidoAte("2026-08-25");
    const ultimoSegundoDoDia = new Date("2026-08-25T23:59:59-03:00").getTime();
    const primeiroSegundoDoDiaSeguinte = new Date("2026-08-26T00:00:00-03:00").getTime();

    expect(checarDisponibilidade(cupom({ validoAte }), 100, {}, ultimoSegundoDoDia)).toBeNull();
    expect(
      checarDisponibilidade(cupom({ validoAte }), 100, {}, primeiroSegundoDoDiaSeguinte)
    ).toEqual({
      mensagem: "Este cupom expirou.",
      status: 400,
    });
  });

  it("não expira às 21h do dia anterior, que é o que dá lendo a data em UTC", () => {
    const validoAte = paraValidoAte("2026-08-25");
    const meioDiaDoDia25 = new Date("2026-08-25T12:00:00-03:00").getTime();
    expect(checarDisponibilidade(cupom({ validoAte }), 100, {}, meioDiaDoDia25)).toBeNull();
  });

  it("recusa quando o limite de usos já foi atingido", () => {
    expect(checarDisponibilidade(cupom({ usoMaximo: 1, usos: 1 }), 100)).toEqual({
      mensagem: "Este cupom já atingiu o limite de usos.",
      status: 400,
    });
    expect(checarDisponibilidade(cupom({ usoMaximo: 2, usos: 1 }), 100)).toBeNull();
  });

  it("cupom sem limite não esgota", () => {
    expect(checarDisponibilidade(cupom({ usoMaximo: null, usos: 9999 }), 100)).toBeNull();
  });

  it("compara o pedido mínimo contra preço × quantidade atual", () => {
    const promo = cupom({ valorMinimoPedido: 100 });
    expect(checarDisponibilidade(promo, 39.9 * 2)).toEqual({
      mensagem: "Pedido mínimo de R$ 100,00 para este cupom.",
      status: 400,
    });
    expect(checarDisponibilidade(promo, 39.9 * 3)).toBeNull();
  });
});

describe("checarDisponibilidade — restrito a um produto", () => {
  it("cupom sem produto vinculado vale pra qualquer produto, mesmo sem contexto nenhum", () => {
    expect(checarDisponibilidade(cupom(), 100)).toBeNull();
    expect(checarDisponibilidade(cupom(), 100, { produtoId: "produto-x" })).toBeNull();
    expect(checarDisponibilidade(cupom(), 100, { produtoId: null })).toBeNull();
  });

  it("libera quando o produto do pedido é exatamente o vinculado", () => {
    const promo = cupom({ produtoId: "produto-x" });
    expect(checarDisponibilidade(promo, 100, { produtoId: "produto-x" })).toBeNull();
  });

  it("recusa quando o produto do pedido é outro", () => {
    const promo = cupom({ produtoId: "produto-x" });
    expect(checarDisponibilidade(promo, 100, { produtoId: "produto-y" })).toEqual({
      mensagem: "Este cupom não vale para este produto.",
      status: 400,
    });
  });

  it("recusa quando o pedido não informa produto nenhum (undefined vira null)", () => {
    const promo = cupom({ produtoId: "produto-x" });
    expect(checarDisponibilidade(promo, 100)).toEqual({
      mensagem: "Este cupom não vale para este produto.",
      status: 400,
    });
    expect(checarDisponibilidade(promo, 100, {})).toEqual({
      mensagem: "Este cupom não vale para este produto.",
      status: 400,
    });
  });

  it("um pedido com dois itens de produtos diferentes não engana a checagem por engano de string vazia", () => {
    const promo = cupom({ produtoId: "produto-x" });
    // string vazia não é igual a "produto-x" nem é o mesmo "nada" que null —
    // continua recusando, não passa por engano de coerção.
    expect(checarDisponibilidade(promo, 100, { produtoId: "" })).toEqual({
      mensagem: "Este cupom não vale para este produto.",
      status: 400,
    });
  });
});

describe("checarDisponibilidade — restrito à primeira compra", () => {
  it("cupom comum (primeiraCompra: false) vale mesmo pra quem já comprou", () => {
    expect(checarDisponibilidade(cupom(), 100, { jaComprou: true })).toBeNull();
  });

  it("libera cupom de primeira compra pra quem nunca comprou", () => {
    const promo = cupom({ primeiraCompra: true });
    expect(checarDisponibilidade(promo, 100, { jaComprou: false })).toBeNull();
    expect(checarDisponibilidade(promo, 100, {})).toBeNull();
    expect(checarDisponibilidade(promo, 100)).toBeNull();
  });

  it("recusa cupom de primeira compra pra quem já comprou antes", () => {
    const promo = cupom({ primeiraCompra: true });
    expect(checarDisponibilidade(promo, 100, { jaComprou: true })).toEqual({
      mensagem: "Este cupom vale só na primeira compra.",
      status: 400,
    });
  });
});

describe("checarDisponibilidade — combinação de travas", () => {
  it("produto errado barra antes mesmo de chegar na checagem de primeira compra", () => {
    const promo = cupom({ produtoId: "produto-x", primeiraCompra: true });
    // Já comprou (violaria as duas regras) e ainda por cima é outro produto:
    // a mensagem devolvida é sempre uma indisponibilidade real, nunca null.
    expect(checarDisponibilidade(promo, 100, { produtoId: "produto-y", jaComprou: true })).toEqual(
      { mensagem: "Este cupom não vale para este produto.", status: 400 }
    );
  });

  it("só libera quando produto bate E é mesmo a primeira compra", () => {
    const promo = cupom({ produtoId: "produto-x", primeiraCompra: true });
    expect(
      checarDisponibilidade(promo, 100, { produtoId: "produto-x", jaComprou: true })
    ).toEqual({ mensagem: "Este cupom vale só na primeira compra.", status: 400 });
    expect(
      checarDisponibilidade(promo, 100, { produtoId: "produto-x", jaComprou: false })
    ).toBeNull();
  });

  it("todas as travas continuam valendo junto com produto e primeira compra", () => {
    const promo = cupom({
      ativo: true,
      usoMaximo: 5,
      usos: 5,
      valorMinimoPedido: 10,
      produtoId: "produto-x",
      primeiraCompra: true,
    });
    // Limite de usos é conferido antes das travas novas — continua sendo o
    // primeiro motivo reportado, mesmo com produto certo e cliente novo.
    expect(
      checarDisponibilidade(promo, 100, { produtoId: "produto-x", jaComprou: false })
    ).toEqual({ mensagem: "Este cupom já atingiu o limite de usos.", status: 400 });
  });
});
