import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ItemCarrinho } from "@/lib/cart-context";

// Mesmo arranjo da suíte de cupons: o que está sob teste é o estoque (e o
// frete grátis) contra o Postgres de verdade, então o Mercado Pago e o ViaCEP
// saem do caminho.
const gateway = vi.hoisted(() => ({
  pagamentoReal: false,
  criarPreferencia: vi.fn(),
}));

vi.mock("@/lib/mercadopago", () => ({
  pagamentoRealConfigurado: () => gateway.pagamentoReal,
  preferenceClient: () => ({ create: gateway.criarPreferencia }),
  paymentClient: () => {
    throw new Error("paymentClient não é usado nesta suíte");
  },
  baseUrl: () => "http://localhost:3000",
}));

const FRETE = 9.9;

vi.mock("./entrega", () => ({
  consultarEnderecoSalvo: async () => ({
    cep: "01310100",
    logradouro: "Av. Paulista",
    bairro: "Bela Vista",
    cidade: "São Paulo",
    uf: "SP",
    frete: { valor: 9.9, prazoDias: 2 },
    destinatario: "Cliente de teste",
    numero: "1000",
    complemento: "",
    rua: "Av. Paulista",
  }),
  resumoDoEnderecoSalvo: () => "Av. Paulista, 1000, Bela Vista — São Paulo/SP",
}));

const { prisma } = await import("@/lib/prisma");
const { criarCupom } = await import("./cupons");
const { criarPedido } = await import("./pedidos");
const { atualizarConfiguracaoLoja } = await import("./configuracao");

const CATEGORIA_ID = "teste-estoque-categoria";
const PRODUTO_ID = "teste-estoque-produto";
const USUARIO_ID = "teste-estoque-usuario";
const PRECO = 100;

const item: ItemCarrinho = { produtoId: PRODUTO_ID, variacoesEscolhidas: {}, quantidade: 1 };

// `estoque: null` é o produto sem controle — o padrão de quem nunca mexeu
// nesse campo. Cada teste define o que precisa.
async function definirEstoque(estoque: number | null) {
  await prisma.produto.update({ where: { id: PRODUTO_ID }, data: { estoque } });
}

async function estoqueAtual() {
  const p = await prisma.produto.findUnique({ where: { id: PRODUTO_ID } });
  return p?.estoque ?? null;
}

async function limpar() {
  await prisma.pedido.deleteMany({ where: { usuarioId: USUARIO_ID } });
  await prisma.cupom.deleteMany({ where: { codigo: { startsWith: "TESTEESTOQUE" } } });
  await prisma.notificacao.deleteMany({ where: { usuarioId: USUARIO_ID } });
  // Singleton compartilhado com o resto da loja: sai daqui do jeito que
  // entrou, senão um teste de frete grátis contamina o seguinte.
  await atualizarConfiguracaoLoja({ freteGratisAcimaDe: null });
}

beforeAll(async () => {
  await limpar();
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
      email: "teste-estoque@example.com",
      senhaHash: "nao-usado",
    },
  });
});

beforeEach(async () => {
  gateway.pagamentoReal = false;
  gateway.criarPreferencia.mockReset();
});

afterEach(async () => {
  await limpar();
  await definirEstoque(null);
});

afterAll(async () => {
  await prisma.produto.deleteMany({ where: { id: PRODUTO_ID } });
  await prisma.usuario.deleteMany({ where: { id: USUARIO_ID } });
  await prisma.categoria.deleteMany({ where: { id: CATEGORIA_ID } });
  await prisma.$disconnect();
});

describe("estoque sob concorrência", () => {
  it("duas compras simultâneas da última unidade: uma passa, a outra ouve que acabou", async () => {
    await definirEstoque(1);

    const resultados = await Promise.allSettled([
      criarPedido(USUARIO_ID, item, "teste-endereco-id"),
      criarPedido(USUARIO_ID, item, "teste-endereco-id"),
    ]);

    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const recusado = resultados.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(recusado.reason).toMatchObject({
      message: expect.stringMatching(/estoque/i),
    });

    expect(await estoqueAtual()).toBe(0);
    // O pedido do perdedor não fica gravado: o erro derruba a transação inteira.
    expect(await prisma.pedido.count({ where: { usuarioId: USUARIO_ID } })).toBe(1);
  });

  it("produto sem controle de estoque aceita as duas compras", async () => {
    await definirEstoque(null);

    await Promise.all([
      criarPedido(USUARIO_ID, item, "teste-endereco-id"),
      criarPedido(USUARIO_ID, item, "teste-endereco-id"),
    ]);

    expect(await estoqueAtual()).toBeNull();
    expect(await prisma.pedido.count({ where: { usuarioId: USUARIO_ID } })).toBe(2);
  });

  it("pedido de mais unidades do que existem é recusado antes de abrir o pagamento", async () => {
    await definirEstoque(2);

    await expect(
      criarPedido(USUARIO_ID, { ...item, quantidade: 3 }, "teste-endereco-id")
    ).rejects.toMatchObject({ message: expect.stringMatching(/Só restam 2/) });

    expect(await estoqueAtual()).toBe(2);
    expect(await prisma.pedido.count({ where: { usuarioId: USUARIO_ID } })).toBe(0);
  });

  it("desconta a quantidade inteira, não uma unidade por pedido", async () => {
    await definirEstoque(5);

    await criarPedido(USUARIO_ID, { ...item, quantidade: 3 }, "teste-endereco-id");

    expect(await estoqueAtual()).toBe(2);
  });
});

describe("devolução do estoque quando o pedido não vinga", () => {
  it("falha ao abrir o pagamento apaga o pedido e devolve as unidades", async () => {
    gateway.pagamentoReal = true;
    gateway.criarPreferencia.mockRejectedValue(new Error("Mercado Pago fora do ar"));
    await definirEstoque(1);

    await expect(criarPedido(USUARIO_ID, item, "teste-endereco-id")).rejects.toMatchObject({
      status: 502,
    });

    expect(await estoqueAtual()).toBe(1);
    expect(await prisma.pedido.count({ where: { usuarioId: USUARIO_ID } })).toBe(0);
  });

  it("a unidade devolvida volta a ser vendável", async () => {
    gateway.pagamentoReal = true;
    gateway.criarPreferencia.mockRejectedValueOnce(new Error("Mercado Pago fora do ar"));
    gateway.criarPreferencia.mockResolvedValue({ init_point: "https://mp.exemplo/checkout" });
    await definirEstoque(1);

    await expect(criarPedido(USUARIO_ID, item, "teste-endereco-id")).rejects.toMatchObject({
      status: 502,
    });
    const { checkoutUrl } = await criarPedido(USUARIO_ID, item, "teste-endereco-id");
    expect(checkoutUrl).toBe("https://mp.exemplo/checkout");

    expect(await estoqueAtual()).toBe(0);
  });
});

describe("frete grátis", () => {
  it("cupom de frete grátis zera o frete sem descontar do produto", async () => {
    await criarCupom({ codigo: "TESTEESTOQUEFRETE", tipo: "FRETE_GRATIS", valor: 0 });

    const { pedido } = await criarPedido(USUARIO_ID, item, "teste-endereco-id", "TESTEESTOQUEFRETE");

    expect(Number(pedido.frete)).toBe(0);
    expect(pedido.freteGratis).toBe(true);
    expect(Number(pedido.desconto)).toBe(0);
    expect(Number(pedido.total)).toBe(PRECO);
  });

  it("valor mínimo da loja zera o frete sem cupom nenhum", async () => {
    await atualizarConfiguracaoLoja({ freteGratisAcimaDe: PRECO });

    const { pedido } = await criarPedido(USUARIO_ID, item, "teste-endereco-id");

    expect(Number(pedido.frete)).toBe(0);
    expect(pedido.freteGratis).toBe(true);
    expect(Number(pedido.total)).toBe(PRECO);
  });

  it("abaixo do valor mínimo o frete continua sendo cobrado", async () => {
    await atualizarConfiguracaoLoja({ freteGratisAcimaDe: PRECO + 1 });

    const { pedido } = await criarPedido(USUARIO_ID, item, "teste-endereco-id");

    expect(Number(pedido.frete)).toBe(FRETE);
    expect(pedido.freteGratis).toBe(false);
    expect(Number(pedido.total)).toBe(PRECO + FRETE);
  });

  it("cupom percentual e frete grátis por valor convivem: desconta o produto e zera o frete", async () => {
    await atualizarConfiguracaoLoja({ freteGratisAcimaDe: PRECO });
    await criarCupom({ codigo: "TESTEESTOQUE10", tipo: "PERCENTUAL", valor: 10 });

    const { pedido } = await criarPedido(USUARIO_ID, item, "teste-endereco-id", "TESTEESTOQUE10");

    expect(Number(pedido.desconto)).toBe(10);
    expect(Number(pedido.frete)).toBe(0);
    expect(pedido.freteGratis).toBe(true);
    expect(Number(pedido.total)).toBe(PRECO - 10);
  });
});

describe("CHECK constraints (rede de segurança do banco)", () => {
  it("barra estoque negativo escrito por fora do serviço", async () => {
    await definirEstoque(1);
    await expect(
      prisma.$executeRaw`UPDATE "Produto" SET estoque = -1 WHERE id = ${PRODUTO_ID}`
    ).rejects.toThrow(/produto_estoque_nao_negativo/);
  });

  it("barra valor mínimo de frete grátis negativo", async () => {
    await expect(
      prisma.$executeRaw`UPDATE "ConfiguracaoLoja" SET "freteGratisAcimaDe" = -1 WHERE id = 'singleton'`
    ).rejects.toThrow(/config_frete_gratis_nao_negativo/);
  });

  it("aceita cupom de frete grátis com valor zero, que a trava antiga barrava", async () => {
    const cupom = await criarCupom({
      codigo: "TESTEESTOQUEZERO",
      tipo: "FRETE_GRATIS",
      valor: 0,
    });

    expect(cupom).toMatchObject({ tipo: "FRETE_GRATIS" });
    expect(Number(cupom.valor)).toBe(0);
  });
});

// --- Estoque por combinação de variação -------------------------------

const PRODUTO_VARIACAO_ID = "teste-estoque-variacao-produto";
const COR_PRETA_G = "Cor:Preta|Tamanho:G";
const COR_BRANCA_G = "Cor:Branca|Tamanho:G";

function itemVariacao(escolhas: Record<string, string>, quantidade = 1): ItemCarrinho {
  return { produtoId: PRODUTO_VARIACAO_ID, variacoesEscolhidas: escolhas, quantidade };
}

async function definirGrade(linhas: { combinacao: string; estoque: number }[]) {
  await prisma.estoqueVariacao.deleteMany({ where: { produtoId: PRODUTO_VARIACAO_ID } });
  if (linhas.length > 0) {
    await prisma.estoqueVariacao.createMany({
      data: linhas.map((l) => ({ ...l, produtoId: PRODUTO_VARIACAO_ID })),
    });
  }
}

async function estoqueDaGrade(combinacao: string) {
  const linha = await prisma.estoqueVariacao.findUnique({
    where: { produtoId_combinacao: { produtoId: PRODUTO_VARIACAO_ID, combinacao } },
  });
  return linha?.estoque ?? null;
}

async function limparVariacao() {
  await prisma.pedido.deleteMany({ where: { usuarioId: USUARIO_ID } });
  await prisma.notificacao.deleteMany({ where: { usuarioId: USUARIO_ID } });
}

describe("estoque por combinação de variação", () => {
  beforeAll(async () => {
    await prisma.produto.deleteMany({ where: { id: PRODUTO_VARIACAO_ID } });
    await prisma.produto.create({
      data: {
        id: PRODUTO_VARIACAO_ID,
        nome: "Produto de teste com variação",
        descricao: "Produto criado pela suíte de integração.",
        categoriaId: CATEGORIA_ID,
        preco: PRECO,
        precoShopee: PRECO + 20,
        emoji: "🧪",
        cor: "#3F6B4C",
        variacoes: {
          create: [
            { tipo: "Cor", valores: ["Preta", "Branca"] },
            { tipo: "Tamanho", valores: ["P", "G"] },
          ],
        },
      },
    });
  });

  afterEach(async () => {
    await limparVariacao();
    await definirGrade([]);
  });

  afterAll(async () => {
    await prisma.produto.deleteMany({ where: { id: PRODUTO_VARIACAO_ID } });
  });

  it("duas compras simultâneas da última unidade de uma combinação: uma passa, a outra ouve que acabou", async () => {
    await definirGrade([{ combinacao: COR_PRETA_G, estoque: 1 }]);
    const item = itemVariacao({ Cor: "Preta", Tamanho: "G" });

    const resultados = await Promise.allSettled([
      criarPedido(USUARIO_ID, item, "teste-endereco-id"),
      criarPedido(USUARIO_ID, item, "teste-endereco-id"),
    ]);

    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const recusado = resultados.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(recusado.reason).toMatchObject({
      message: expect.stringMatching(/estoque/i),
    });
    expect(await estoqueDaGrade(COR_PRETA_G)).toBe(0);
  });

  it("uma combinação zerada não afeta as outras combinações do mesmo produto", async () => {
    await definirGrade([
      { combinacao: COR_PRETA_G, estoque: 0 },
      { combinacao: COR_BRANCA_G, estoque: 5 },
    ]);

    await expect(
      criarPedido(USUARIO_ID, itemVariacao({ Cor: "Preta", Tamanho: "G" }), "teste-endereco-id")
    ).rejects.toMatchObject({ message: expect.stringMatching(/sem estoque/i) });

    await criarPedido(USUARIO_ID, itemVariacao({ Cor: "Branca", Tamanho: "G" }), "teste-endereco-id");
    expect(await estoqueDaGrade(COR_BRANCA_G)).toBe(4);
  });

  it("combinação sem linha na grade é tratada como esgotada", async () => {
    await definirGrade([{ combinacao: COR_PRETA_G, estoque: 5 }]);

    await expect(
      criarPedido(USUARIO_ID, itemVariacao({ Cor: "Branca", Tamanho: "P" }), "teste-endereco-id")
    ).rejects.toMatchObject({ message: expect.stringMatching(/sem estoque/i) });
  });

  it("produto com variações mas sem nenhuma linha de grade vende sem controle (controle desligado)", async () => {
    await definirGrade([]);

    await criarPedido(USUARIO_ID, itemVariacao({ Cor: "Preta", Tamanho: "G" }), "teste-endereco-id");
    // Sem erro nenhum — nenhuma linha existe pra decrementar, o produto
    // passa direto, igual a `estoque: null` no caminho sem variação.
  });

  it("falha ao abrir o pagamento devolve a unidade pra combinação certa", async () => {
    gateway.pagamentoReal = true;
    gateway.criarPreferencia.mockRejectedValue(new Error("Mercado Pago fora do ar"));
    await definirGrade([{ combinacao: COR_PRETA_G, estoque: 1 }]);

    await expect(
      criarPedido(USUARIO_ID, itemVariacao({ Cor: "Preta", Tamanho: "G" }), "teste-endereco-id")
    ).rejects.toMatchObject({ status: 502 });

    expect(await estoqueDaGrade(COR_PRETA_G)).toBe(1);
    gateway.pagamentoReal = false;
  });
});
