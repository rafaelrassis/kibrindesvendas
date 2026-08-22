import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

const { prisma } = await import("@/lib/prisma");
const { getCarrinho, limparCarrinho, salvarCarrinho } = await import("./carrinho");

const USUARIO_ID = "teste-carrinho-usuario";
const PRODUTO_ID = "teste-carrinho-produto";

async function limpar() {
  await prisma.carrinhoItem.deleteMany({ where: { usuarioId: USUARIO_ID } });
}

beforeAll(async () => {
  await prisma.usuario.deleteMany({ where: { id: USUARIO_ID } });
  await prisma.usuario.create({
    data: {
      id: USUARIO_ID,
      nome: "Cliente de teste",
      email: "teste-carrinho@example.com",
      senhaHash: "nao-usado",
    },
  });
});

afterEach(limpar);

afterAll(async () => {
  await prisma.usuario.deleteMany({ where: { id: USUARIO_ID } });
  await prisma.$disconnect();
});

describe("carrinho persistido no banco", () => {
  it("sem nada salvo, devolve null", async () => {
    expect(await getCarrinho(USUARIO_ID)).toBeNull();
  });

  it("salva e lê o item de volta", async () => {
    const salvo = await salvarCarrinho(USUARIO_ID, {
      produtoId: PRODUTO_ID,
      variacoesEscolhidas: { Cor: "Preta" },
      quantidade: 2,
      cepInformado: "01310100",
    });

    expect(salvo).toMatchObject({
      produtoId: PRODUTO_ID,
      variacoesEscolhidas: { Cor: "Preta" },
      quantidade: 2,
      cepInformado: "01310100",
    });
    expect(await getCarrinho(USUARIO_ID)).toMatchObject({ produtoId: PRODUTO_ID, quantidade: 2 });
  });

  it("salvar de novo substitui o item anterior (upsert, não acumula linha)", async () => {
    await salvarCarrinho(USUARIO_ID, {
      produtoId: PRODUTO_ID,
      variacoesEscolhidas: {},
      quantidade: 1,
    });
    await salvarCarrinho(USUARIO_ID, {
      produtoId: "outro-produto",
      variacoesEscolhidas: {},
      quantidade: 3,
    });

    expect(await prisma.carrinhoItem.count({ where: { usuarioId: USUARIO_ID } })).toBe(1);
    expect(await getCarrinho(USUARIO_ID)).toMatchObject({ produtoId: "outro-produto", quantidade: 3 });
  });

  it("quantidade fora do inteiro positivo cai pro piso de 1", async () => {
    const salvo = await salvarCarrinho(USUARIO_ID, {
      produtoId: PRODUTO_ID,
      variacoesEscolhidas: {},
      quantidade: -5,
    });
    expect(salvo.quantidade).toBe(1);
  });

  it("personalização gravada volta a sair na leitura", async () => {
    const personalizacao = { via: "UPLOAD" as const, resumo: "arte enviada", aceite: true };
    await salvarCarrinho(USUARIO_ID, {
      produtoId: PRODUTO_ID,
      variacoesEscolhidas: {},
      quantidade: 1,
      personalizacao,
    });

    expect(await getCarrinho(USUARIO_ID)).toMatchObject({ personalizacao });
  });

  it("salvar sem personalização depois de ter salvo uma remove a anterior", async () => {
    await salvarCarrinho(USUARIO_ID, {
      produtoId: PRODUTO_ID,
      variacoesEscolhidas: {},
      quantidade: 1,
      personalizacao: { via: "UPLOAD", resumo: "arte enviada", aceite: true },
    });
    await salvarCarrinho(USUARIO_ID, {
      produtoId: PRODUTO_ID,
      variacoesEscolhidas: {},
      quantidade: 1,
    });

    expect(await getCarrinho(USUARIO_ID)).toEqual(
      expect.not.objectContaining({ personalizacao: expect.anything() })
    );
  });

  it("recusa item sem produtoId", async () => {
    await expect(
      salvarCarrinho(USUARIO_ID, { variacoesEscolhidas: {}, quantidade: 1 })
    ).rejects.toMatchObject({ message: expect.stringMatching(/inválido/i) });
  });

  it("limpar apaga a linha, e chamar de novo sem linha nenhuma não quebra", async () => {
    await salvarCarrinho(USUARIO_ID, { produtoId: PRODUTO_ID, variacoesEscolhidas: {}, quantidade: 1 });
    await limparCarrinho(USUARIO_ID);
    expect(await getCarrinho(USUARIO_ID)).toBeNull();

    await expect(limparCarrinho(USUARIO_ID)).resolves.not.toThrow();
  });
});
