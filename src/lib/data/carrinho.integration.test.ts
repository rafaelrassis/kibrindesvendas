import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

const { prisma } = await import("@/lib/prisma");
const { getCarrinho, limparCarrinho, salvarCarrinho, MAX_LINHAS_CARRINHO } = await import(
  "./carrinho"
);

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
  it("sem nada salvo, devolve lista vazia", async () => {
    expect(await getCarrinho(USUARIO_ID)).toEqual([]);
  });

  it("salva e lê a linha de volta, com o id que veio do navegador", async () => {
    const salvo = await salvarCarrinho(USUARIO_ID, [
      {
        id: "linha-a",
        produtoId: PRODUTO_ID,
        variacoesEscolhidas: { Cor: "Preta" },
        quantidade: 2,
        cepInformado: "01310100",
      },
    ]);

    expect(salvo).toEqual([
      {
        id: "linha-a",
        produtoId: PRODUTO_ID,
        variacoesEscolhidas: { Cor: "Preta" },
        quantidade: 2,
        cepInformado: "01310100",
      },
    ]);
    expect(await getCarrinho(USUARIO_ID)).toMatchObject([{ produtoId: PRODUTO_ID, quantidade: 2 }]);
  });

  it("guarda várias linhas, na ordem em que foram enviadas", async () => {
    await salvarCarrinho(USUARIO_ID, [
      { id: "b", produtoId: "produto-b", variacoesEscolhidas: {}, quantidade: 1 },
      { id: "a", produtoId: "produto-a", variacoesEscolhidas: {}, quantidade: 3 },
      { id: "c", produtoId: "produto-b", variacoesEscolhidas: { Cor: "Preta" }, quantidade: 2 },
    ]);

    const lidas = await getCarrinho(USUARIO_ID);
    expect(lidas.map((l) => l.id)).toEqual(["b", "a", "c"]);
    expect(lidas.map((l) => l.quantidade)).toEqual([1, 3, 2]);
  });

  it("salvar de novo substitui o carrinho inteiro (some o que não veio)", async () => {
    await salvarCarrinho(USUARIO_ID, [
      { id: "a", produtoId: PRODUTO_ID, variacoesEscolhidas: {}, quantidade: 1 },
      { id: "b", produtoId: "outro-produto", variacoesEscolhidas: {}, quantidade: 1 },
    ]);
    await salvarCarrinho(USUARIO_ID, [
      { id: "b", produtoId: "outro-produto", variacoesEscolhidas: {}, quantidade: 3 },
    ]);

    expect(await prisma.carrinhoItem.count({ where: { usuarioId: USUARIO_ID } })).toBe(1);
    expect(await getCarrinho(USUARIO_ID)).toMatchObject([{ id: "b", quantidade: 3 }]);
  });

  it("aceita um item solto (formato antigo) como carrinho de 1 linha", async () => {
    const salvo = await salvarCarrinho(USUARIO_ID, {
      produtoId: PRODUTO_ID,
      variacoesEscolhidas: {},
      quantidade: 1,
    });
    expect(salvo).toHaveLength(1);
    expect(salvo[0].produtoId).toBe(PRODUTO_ID);
  });

  it("quantidade fora do inteiro positivo cai pro piso de 1", async () => {
    const [salvo] = await salvarCarrinho(USUARIO_ID, [
      { id: "a", produtoId: PRODUTO_ID, variacoesEscolhidas: {}, quantidade: -5 },
    ]);
    expect(salvo.quantidade).toBe(1);
  });

  it("personalização gravada volta a sair na leitura", async () => {
    const personalizacao = { via: "UPLOAD" as const, resumo: "arte enviada", aceite: true };
    await salvarCarrinho(USUARIO_ID, [
      { id: "a", produtoId: PRODUTO_ID, variacoesEscolhidas: {}, quantidade: 1, personalizacao },
    ]);

    expect(await getCarrinho(USUARIO_ID)).toMatchObject([{ personalizacao }]);
  });

  it("salvar sem personalização depois de ter salvo uma remove a anterior", async () => {
    await salvarCarrinho(USUARIO_ID, [
      {
        id: "a",
        produtoId: PRODUTO_ID,
        variacoesEscolhidas: {},
        quantidade: 1,
        personalizacao: { via: "UPLOAD", resumo: "arte enviada", aceite: true },
      },
    ]);
    await salvarCarrinho(USUARIO_ID, [
      { id: "a", produtoId: PRODUTO_ID, variacoesEscolhidas: {}, quantidade: 1 },
    ]);

    const [linha] = await getCarrinho(USUARIO_ID);
    expect(linha).toEqual(expect.not.objectContaining({ personalizacao: expect.anything() }));
  });

  it("guarda o preço visto ao adicionar e devolve na leitura", async () => {
    await salvarCarrinho(USUARIO_ID, [
      { id: "a", produtoId: PRODUTO_ID, variacoesEscolhidas: {}, quantidade: 1, precoAdicionado: 39.9 },
      { id: "b", produtoId: "outro", variacoesEscolhidas: {}, quantidade: 1 },
    ]);
    const [a, b] = await getCarrinho(USUARIO_ID);
    expect(a.precoAdicionado).toBe(39.9);
    expect(b.precoAdicionado).toBeUndefined();
  });

  it("mexer no carrinho zera o marcador do lembrete de carrinho esquecido", async () => {
    await prisma.usuario.update({
      where: { id: USUARIO_ID },
      data: { carrinhoLembreteEm: new Date() },
    });
    await salvarCarrinho(USUARIO_ID, [
      { id: "a", produtoId: PRODUTO_ID, variacoesEscolhidas: {}, quantidade: 1 },
    ]);
    const usuario = await prisma.usuario.findUnique({ where: { id: USUARIO_ID } });
    expect(usuario?.carrinhoLembreteEm).toBeNull();
  });

  it("recusa linha sem produtoId", async () => {
    await expect(
      salvarCarrinho(USUARIO_ID, [{ variacoesEscolhidas: {}, quantidade: 1 }])
    ).rejects.toMatchObject({ message: expect.stringMatching(/inválido/i) });
  });

  it("recusa ids de linha repetidos", async () => {
    await expect(
      salvarCarrinho(USUARIO_ID, [
        { id: "a", produtoId: PRODUTO_ID, variacoesEscolhidas: {}, quantidade: 1 },
        { id: "a", produtoId: "outro", variacoesEscolhidas: {}, quantidade: 1 },
      ])
    ).rejects.toMatchObject({ message: expect.stringMatching(/repetidos/i) });
  });

  it("recusa carrinho com linhas demais", async () => {
    const linhas = Array.from({ length: MAX_LINHAS_CARRINHO + 1 }, (_, i) => ({
      id: `l${i}`,
      produtoId: PRODUTO_ID,
      variacoesEscolhidas: {},
      quantidade: 1,
    }));
    await expect(salvarCarrinho(USUARIO_ID, linhas)).rejects.toMatchObject({
      message: expect.stringMatching(/no máximo/i),
    });
  });

  it("carrinho de um usuário não aparece no de outro", async () => {
    await salvarCarrinho(USUARIO_ID, [
      { id: "a", produtoId: PRODUTO_ID, variacoesEscolhidas: {}, quantidade: 1 },
    ]);
    expect(await getCarrinho("outro-usuario-sem-carrinho")).toEqual([]);
  });

  it("limpar apaga as linhas, e chamar de novo sem linha nenhuma não quebra", async () => {
    await salvarCarrinho(USUARIO_ID, [
      { id: "a", produtoId: PRODUTO_ID, variacoesEscolhidas: {}, quantidade: 1 },
      { id: "b", produtoId: "outro", variacoesEscolhidas: {}, quantidade: 1 },
    ]);
    await limparCarrinho(USUARIO_ID);
    expect(await getCarrinho(USUARIO_ID)).toEqual([]);

    await expect(limparCarrinho(USUARIO_ID)).resolves.not.toThrow();
  });
});
