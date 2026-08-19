import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { ItemCarrinho } from "@/lib/cart-context";
import { fimDoDiaBrasilia } from "@/lib/cupom";

// Estado que os mocks leem — `vi.hoisted` porque as fábricas de `vi.mock`
// sobem pro topo do arquivo e não enxergam variáveis normais.
const gateway = vi.hoisted(() => ({
  pagamentoReal: false,
  criarPreferencia: vi.fn(),
}));

// O que está sob teste é o cupom, não o Mercado Pago nem o ViaCEP: os dois
// saem do caminho pra sobrar só o banco de verdade.
vi.mock("@/lib/mercadopago", () => ({
  pagamentoRealConfigurado: () => gateway.pagamentoReal,
  preferenceClient: () => ({ create: gateway.criarPreferencia }),
  paymentClient: () => {
    throw new Error("paymentClient não é usado nesta suíte");
  },
  baseUrl: () => "http://localhost:3000",
}));

vi.mock("./entrega", () => ({
  consultarCep: async () => ({
    cep: "01310100",
    logradouro: "Av. Paulista",
    bairro: "Bela Vista",
    cidade: "São Paulo",
    uf: "SP",
    frete: { valor: 9.9, prazoDias: 2 },
  }),
  resumoDoEndereco: () => "Av. Paulista, Bela Vista — São Paulo/SP",
}));

const { prisma } = await import("@/lib/prisma");
const { atualizarCupom, criarCupom, devolverUsoCupom, registrarUsoCupom } = await import(
  "./cupons"
);
const { criarPedido } = await import("./pedidos");

const CATEGORIA_ID = "teste-cupom-categoria";
const PRODUTO_ID = "teste-cupom-produto";
const USUARIO_ID = "teste-cupom-usuario";
const PRECO = 100;

const item: ItemCarrinho = { produtoId: PRODUTO_ID, variacoesEscolhidas: {}, quantidade: 1 };

function esperar(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Todo cupom da suíte começa com TESTE, então a limpeza não encosta em nada
// que já estivesse no banco.
async function limparCupons() {
  await prisma.pedido.deleteMany({ where: { usuarioId: USUARIO_ID } });
  await prisma.cupom.deleteMany({ where: { codigo: { startsWith: "TESTE" } } });
  await prisma.notificacao.deleteMany({ where: { usuarioId: USUARIO_ID } });
}

beforeAll(async () => {
  await limparCupons();
  await prisma.produto.deleteMany({ where: { id: PRODUTO_ID } });
  await prisma.usuario.deleteMany({ where: { id: USUARIO_ID } });
  await prisma.categoria.deleteMany({ where: { id: CATEGORIA_ID } });

  await prisma.categoria.create({
    data: { id: CATEGORIA_ID, slug: CATEGORIA_ID, label: "Teste" },
  });
  await prisma.produto.create({
    data: {
      id: PRODUTO_ID,
      nome: "Produto de teste",
      descricao: "Produto criado pela suíte de integração.",
      categoriaId: CATEGORIA_ID,
      preco: PRECO,
      precoShopee: PRECO + 20,
      emoji: "🧪",
      cor: "#3F6B4C",
    },
  });
  await prisma.usuario.create({
    data: {
      id: USUARIO_ID,
      nome: "Cliente de teste",
      email: "teste-cupom@example.com",
      senhaHash: "nao-usado",
    },
  });
});

afterEach(async () => {
  gateway.pagamentoReal = false;
  gateway.criarPreferencia.mockReset();
  await limparCupons();
});

afterAll(async () => {
  await prisma.produto.deleteMany({ where: { id: PRODUTO_ID } });
  await prisma.usuario.deleteMany({ where: { id: USUARIO_ID } });
  await prisma.categoria.deleteMany({ where: { id: CATEGORIA_ID } });
  await prisma.$disconnect();
});

describe("limite de usos sob concorrência", () => {
  it("duas transações abertas ao mesmo tempo só consomem um uso", async () => {
    const cupom = await criarCupom({
      codigo: "TESTEATOMICO",
      tipo: "FIXO",
      valor: 10,
      usoMaximo: 1,
    });

    // A primeira segura a transação aberta depois de incrementar; a segunda
    // esbarra na linha travada, espera o commit e só então avalia o limite —
    // que já está cheio. É esse o cenário que o incremento cego perdia.
    const primeira = prisma.$transaction(async (tx) => {
      await registrarUsoCupom(cupom.id, tx);
      await esperar(300);
    });
    await esperar(50);
    const segunda = prisma.$transaction((tx) => registrarUsoCupom(cupom.id, tx));

    const resultados = await Promise.allSettled([primeira, segunda]);
    expect(resultados.map((r) => r.status)).toEqual(["fulfilled", "rejected"]);
    expect((resultados[1] as PromiseRejectedResult).reason).toMatchObject({
      status: 409,
      message: expect.stringMatching(/limite de usos/),
    });

    const depois = await prisma.cupom.findUnique({ where: { id: cupom.id } });
    expect(depois?.usos).toBe(1);
  });

  it("dois pedidos em paralelo com usoMaximo 1: um passa, um ouve que o cupom acabou", async () => {
    await criarCupom({ codigo: "TESTELIMITE", tipo: "PERCENTUAL", valor: 10, usoMaximo: 1 });

    const resultados = await Promise.allSettled([
      criarPedido(USUARIO_ID, item, "01310100", "TESTELIMITE"),
      criarPedido(USUARIO_ID, item, "01310100", "TESTELIMITE"),
    ]);

    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const recusado = resultados.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(recusado.reason).toMatchObject({ message: expect.stringMatching(/limite de usos/) });

    const cupom = await prisma.cupom.findUnique({ where: { codigo: "TESTELIMITE" } });
    expect(cupom?.usos).toBe(1);
    // O pedido do perdedor não fica gravado: o erro derruba a transação inteira.
    expect(await prisma.pedido.count({ where: { cupomCodigo: "TESTELIMITE" } })).toBe(1);
  });

  it("cupom sem limite aceita as duas compras", async () => {
    await criarCupom({ codigo: "TESTESEMLIMITE", tipo: "PERCENTUAL", valor: 10 });

    await Promise.all([
      criarPedido(USUARIO_ID, item, "01310100", "TESTESEMLIMITE"),
      criarPedido(USUARIO_ID, item, "01310100", "TESTESEMLIMITE"),
    ]);

    const cupom = await prisma.cupom.findUnique({ where: { codigo: "TESTESEMLIMITE" } });
    expect(cupom?.usos).toBe(2);
  });
});

describe("reversão do uso quando o pedido não vinga", () => {
  it("falha ao abrir o pagamento apaga o pedido e devolve o uso do cupom", async () => {
    gateway.pagamentoReal = true;
    gateway.criarPreferencia.mockRejectedValue(new Error("Mercado Pago fora do ar"));
    await criarCupom({ codigo: "TESTEMP", tipo: "PERCENTUAL", valor: 10, usoMaximo: 2 });

    await expect(criarPedido(USUARIO_ID, item, "01310100", "TESTEMP")).rejects.toMatchObject({
      status: 502,
    });

    const cupom = await prisma.cupom.findUnique({ where: { codigo: "TESTEMP" } });
    expect(cupom?.usos).toBe(0);
    expect(await prisma.pedido.count({ where: { cupomCodigo: "TESTEMP" } })).toBe(0);
  });

  it("a vaga devolvida volta a ser vendável", async () => {
    gateway.pagamentoReal = true;
    gateway.criarPreferencia.mockRejectedValueOnce(new Error("Mercado Pago fora do ar"));
    gateway.criarPreferencia.mockResolvedValue({ init_point: "https://mp.exemplo/checkout" });
    await criarCupom({ codigo: "TESTEVAGA", tipo: "FIXO", valor: 5, usoMaximo: 1 });

    await expect(criarPedido(USUARIO_ID, item, "01310100", "TESTEVAGA")).rejects.toMatchObject({
      status: 502,
    });
    const { checkoutUrl } = await criarPedido(USUARIO_ID, item, "01310100", "TESTEVAGA");
    expect(checkoutUrl).toBe("https://mp.exemplo/checkout");

    const cupom = await prisma.cupom.findUnique({ where: { codigo: "TESTEVAGA" } });
    expect(cupom?.usos).toBe(1);
  });

  it("devolver duas vezes não leva o contador pra baixo de zero", async () => {
    const cupom = await criarCupom({ codigo: "TESTEZERO", tipo: "FIXO", valor: 5 });

    await prisma.$transaction(async (tx) => {
      await devolverUsoCupom("testezero", tx);
      await devolverUsoCupom("TESTEZERO", tx);
    });

    const depois = await prisma.cupom.findUnique({ where: { id: cupom.id } });
    expect(depois?.usos).toBe(0);
  });
});

describe("cadastro do cupom", () => {
  it("guarda a validade no fim do dia em Brasília, não em UTC", async () => {
    const criado = await criarCupom({
      codigo: "TESTEVALIDADE",
      tipo: "PERCENTUAL",
      valor: 10,
      validoAte: "2026-08-25",
    });

    const gravado = await prisma.cupom.findUnique({ where: { id: criado.id } });
    expect(gravado?.validoAte?.toISOString()).toBe(fimDoDiaBrasilia("2026-08-25").toISOString());
    expect(gravado?.validoAte?.toISOString()).toBe("2026-08-26T02:59:59.999Z");
  });

  it("editar pra um código que já é de outro cupom devolve 409, não 500", async () => {
    await criarCupom({ codigo: "TESTEUM", tipo: "FIXO", valor: 5 });
    const outro = await criarCupom({ codigo: "TESTEDOIS", tipo: "FIXO", valor: 5 });

    await expect(atualizarCupom(outro.id, { codigo: "testeum" })).rejects.toMatchObject({
      status: 409,
      message: "Já existe um cupom com esse código.",
    });

    // Salvar o próprio código de novo continua sendo uma edição válida.
    await expect(atualizarCupom(outro.id, { codigo: "TESTEDOIS", valor: 7 })).resolves.toMatchObject(
      { codigo: "TESTEDOIS", valor: 7 }
    );
  });
});

describe("CHECK constraints (rede de segurança do banco)", () => {
  it("barra valor não positivo escrito por fora do serviço", async () => {
    await criarCupom({ codigo: "TESTECHECK", tipo: "FIXO", valor: 5 });
    await expect(
      prisma.$executeRaw`UPDATE "Cupom" SET valor = 0 WHERE codigo = 'TESTECHECK'`
    ).rejects.toThrow(/cupom_valor_positivo/);
  });

  it("barra percentual acima de 100 e contador negativo", async () => {
    await criarCupom({ codigo: "TESTECHECK2", tipo: "PERCENTUAL", valor: 10 });
    await expect(
      prisma.$executeRaw`UPDATE "Cupom" SET valor = 101 WHERE codigo = 'TESTECHECK2'`
    ).rejects.toThrow(/cupom_percentual_max/);
    await expect(
      prisma.$executeRaw`UPDATE "Cupom" SET usos = -1 WHERE codigo = 'TESTECHECK2'`
    ).rejects.toThrow(/cupom_usos_nao_negativo/);
  });
});
