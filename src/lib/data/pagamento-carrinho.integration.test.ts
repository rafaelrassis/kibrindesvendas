import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ItemCarrinho } from "@/lib/cart-context";

// A sacola gravada no banco só é esvaziada quando o pagamento é confirmado
// (ver LimparCarrinhoAoConfirmar e registrarRetornoDoPagamento); pagamento
// recusado tem que deixar o item intacto, pra "tentar de novo pela sacola"
// valer de verdade. Mercado Pago e ViaCEP saem do caminho, como nas outras
// suítes de integração.
const gateway = vi.hoisted(() => ({
  criarPreferencia: vi.fn(),
  getPagamento: vi.fn(),
}));

vi.mock("@/lib/mercadopago", () => ({
  pagamentoRealConfigurado: () => true,
  preferenceClient: () => ({ create: gateway.criarPreferencia }),
  paymentClient: () => ({ get: gateway.getPagamento }),
  baseUrl: () => "http://localhost:3000",
}));

vi.mock("./entrega", () => ({
  consultarEnderecoSalvo: async () => ({
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
const { criarPedido, registrarRetornoDoPagamento } = await import("./pedidos");
const { getCarrinho, salvarCarrinho } = await import("./carrinho");

const CATEGORIA_ID = "teste-pagcarrinho-categoria";
const PRODUTO_ID = "teste-pagcarrinho-produto";
const USUARIO_ID = "teste-pagcarrinho-usuario";
const PRECO = 100;

const item: ItemCarrinho = { produtoId: PRODUTO_ID, variacoesEscolhidas: {}, quantidade: 1 };

async function limpar() {
  await prisma.pedido.deleteMany({ where: { usuarioId: USUARIO_ID } });
  await prisma.carrinhoItem.deleteMany({ where: { usuarioId: USUARIO_ID } });
  await prisma.notificacao.deleteMany({ where: { usuarioId: USUARIO_ID } });
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
      email: "teste-pagcarrinho@example.com",
      senhaHash: "nao-usado",
    },
  });
});

beforeEach(() => {
  gateway.criarPreferencia.mockReset().mockResolvedValue({ init_point: "https://mp.exemplo/checkout" });
  gateway.getPagamento.mockReset();
});

afterEach(limpar);

afterAll(async () => {
  await prisma.produto.deleteMany({ where: { id: PRODUTO_ID } });
  await prisma.usuario.deleteMany({ where: { id: USUARIO_ID } });
  await prisma.categoria.deleteMany({ where: { id: CATEGORIA_ID } });
  await prisma.$disconnect();
});

describe("carrinho gravado x confirmação de pagamento", () => {
  it("pagamento aprovado esvazia a sacola do banco", async () => {
    await salvarCarrinho(USUARIO_ID, item);
    const { pedido } = await criarPedido(USUARIO_ID, item, "01310100");

    gateway.getPagamento.mockResolvedValue({
      id: "pagamento-aprovado",
      status: "approved",
      external_reference: pedido.id,
    });
    await registrarRetornoDoPagamento("pagamento-aprovado");

    const atualizado = await prisma.pedido.findUnique({ where: { id: pedido.id } });
    expect(atualizado?.status).toBe("PAGO");
    expect(await getCarrinho(USUARIO_ID)).toBeNull();
  });

  it("pagamento recusado mantém a sacola intacta pra tentar de novo", async () => {
    await salvarCarrinho(USUARIO_ID, item);
    const { pedido } = await criarPedido(USUARIO_ID, item, "01310100");

    gateway.getPagamento.mockResolvedValue({
      id: "pagamento-recusado",
      status: "rejected",
      external_reference: pedido.id,
    });
    await registrarRetornoDoPagamento("pagamento-recusado");

    const atualizado = await prisma.pedido.findUnique({ where: { id: pedido.id } });
    expect(atualizado?.status).toBe("CANCELADO");
    expect(await getCarrinho(USUARIO_ID)).toMatchObject({ produtoId: PRODUTO_ID });
  });
});
