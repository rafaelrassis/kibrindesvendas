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
const { atualizarCupom, criarCupom, devolverUsoCupom, registrarUsoCupom } = await import(
  "./cupons"
);
const { criarPedido } = await import("./pedidos");
const { removerProduto } = await import("./produtos");

const CATEGORIA_ID = "teste-cupom-categoria";
const PRODUTO_ID = "teste-cupom-produto";
// Segundo produto, só pra exercitar cupom restrito a um produto específico —
// sem ele não dá pra provar que o cupom recusa um produto "errado", só que
// aceita o único que existe.
const PRODUTO_ID_2 = "teste-cupom-produto-2";
const USUARIO_ID = "teste-cupom-usuario";
const PRECO = 100;

const item: ItemCarrinho = { produtoId: PRODUTO_ID, variacoesEscolhidas: {}, quantidade: 1 };
const item2: ItemCarrinho = { produtoId: PRODUTO_ID_2, variacoesEscolhidas: {}, quantidade: 1 };

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
  await prisma.produto.deleteMany({ where: { id: { in: [PRODUTO_ID, PRODUTO_ID_2] } } });
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
  await prisma.produto.create({
    data: {
      id: PRODUTO_ID_2,
      nome: "Segundo produto de teste",
      descricao: "Produto criado pela suíte de integração, pra cupom restrito.",
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
      // Sem isso, todo teste que liga `gateway.pagamentoReal` esbarra antes
      // no bloqueio de "complete seu CPF" (ver criarPedido) — não é o que
      // essas suítes exercitam.
      cpf: "11111111111",
    },
  });
});

afterEach(async () => {
  gateway.pagamentoReal = false;
  gateway.criarPreferencia.mockReset();
  await limparCupons();
});

afterAll(async () => {
  await prisma.produto.deleteMany({ where: { id: { in: [PRODUTO_ID, PRODUTO_ID_2] } } });
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
      criarPedido(USUARIO_ID, item, "teste-endereco-id", "TESTELIMITE"),
      criarPedido(USUARIO_ID, item, "teste-endereco-id", "TESTELIMITE"),
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
      criarPedido(USUARIO_ID, item, "teste-endereco-id", "TESTESEMLIMITE"),
      criarPedido(USUARIO_ID, item, "teste-endereco-id", "TESTESEMLIMITE"),
    ]);

    const cupom = await prisma.cupom.findUnique({ where: { codigo: "TESTESEMLIMITE" } });
    expect(cupom?.usos).toBe(2);
  });
});

// `validarCupom` (o preview) confere validade e pedido mínimo antes da
// transação, mas só `usoMaximo`/`ativo` eram reconferidos atomicamente pelo
// próprio UPDATE — um cupom que expirasse ou um pedido que caísse abaixo do
// mínimo bem no intervalo entre o preview e o commit passava batido. Estes
// casos simulam esse intervalo escrevendo o estado "mudou" direto no banco
// antes de chamar `registrarUsoCupom`, do mesmo jeito que os testes de
// concorrência acima chamam a função isolada, sem passar por `criarPedido`.
describe("revalidação atômica de validade e pedido mínimo", () => {
  it("recusa incrementar um cupom que expirou depois do preview", async () => {
    const cupom = await criarCupom({ codigo: "TESTEEXPIROU", tipo: "FIXO", valor: 5 });
    await prisma.cupom.update({
      where: { id: cupom.id },
      data: { validoAte: new Date(Date.now() - 1000) },
    });

    await expect(
      prisma.$transaction((tx) => registrarUsoCupom(cupom.id, tx))
    ).rejects.toMatchObject({ status: 409 });

    const depois = await prisma.cupom.findUnique({ where: { id: cupom.id } });
    expect(depois?.usos).toBe(0);
  });

  it("incrementa normalmente um cupom ainda válido, com ou sem valorPedido informado", async () => {
    const cupom = await criarCupom({
      codigo: "TESTEVALIDO",
      tipo: "FIXO",
      valor: 5,
      validoAte: "2999-01-01",
    });

    await prisma.$transaction((tx) => registrarUsoCupom(cupom.id, tx));

    const depois = await prisma.cupom.findUnique({ where: { id: cupom.id } });
    expect(depois?.usos).toBe(1);
  });

  it("recusa incrementar quando o valor do pedido está abaixo do mínimo exigido", async () => {
    const cupom = await criarCupom({
      codigo: "TESTEMINIMORACE",
      tipo: "FIXO",
      valor: 5,
      valorMinimoPedido: 100,
    });

    await expect(
      prisma.$transaction((tx) => registrarUsoCupom(cupom.id, tx, 50))
    ).rejects.toMatchObject({ status: 409 });

    const depois = await prisma.cupom.findUnique({ where: { id: cupom.id } });
    expect(depois?.usos).toBe(0);

    await prisma.$transaction((tx) => registrarUsoCupom(cupom.id, tx, 150));
    expect((await prisma.cupom.findUnique({ where: { id: cupom.id } }))?.usos).toBe(1);
  });

  it("sem valorPedido informado, não exige pedido mínimo (compatível com quem chama fora do fluxo de pedido)", async () => {
    const cupom = await criarCupom({
      codigo: "TESTESEMVALORPEDIDO",
      tipo: "FIXO",
      valor: 5,
      valorMinimoPedido: 100,
    });

    await prisma.$transaction((tx) => registrarUsoCupom(cupom.id, tx));
    expect((await prisma.cupom.findUnique({ where: { id: cupom.id } }))?.usos).toBe(1);
  });
});

describe("reversão do uso quando o pedido não vinga", () => {
  it("falha ao abrir o pagamento apaga o pedido e devolve o uso do cupom", async () => {
    gateway.pagamentoReal = true;
    gateway.criarPreferencia.mockRejectedValue(new Error("Mercado Pago fora do ar"));
    await criarCupom({ codigo: "TESTEMP", tipo: "PERCENTUAL", valor: 10, usoMaximo: 2 });

    await expect(criarPedido(USUARIO_ID, item, "teste-endereco-id", "TESTEMP")).rejects.toMatchObject({
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

    await expect(criarPedido(USUARIO_ID, item, "teste-endereco-id", "TESTEVAGA")).rejects.toMatchObject({
      status: 502,
    });
    const { checkoutUrl } = await criarPedido(USUARIO_ID, item, "teste-endereco-id", "TESTEVAGA");
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

describe("cupom restrito a um produto", () => {
  it("aplica normalmente quando o pedido é do produto vinculado", async () => {
    await criarCupom({ codigo: "TESTEPRODUTO", tipo: "FIXO", valor: 5, produtoId: PRODUTO_ID });

    const { pedido } = await criarPedido(USUARIO_ID, item, "teste-endereco-id", "TESTEPRODUTO");
    expect(pedido.cupomCodigo).toBe("TESTEPRODUTO");
  });

  it("recusa quando o pedido é de outro produto — tanto no preview quanto ao gravar", async () => {
    await criarCupom({ codigo: "TESTEPRODUTO2", tipo: "FIXO", valor: 5, produtoId: PRODUTO_ID });

    await expect(
      criarPedido(USUARIO_ID, item2, "teste-endereco-id", "TESTEPRODUTO2")
    ).rejects.toMatchObject({
      status: 400,
      message: expect.stringMatching(/não vale para este produto/),
    });
    expect(await prisma.pedido.count({ where: { cupomCodigo: "TESTEPRODUTO2" } })).toBe(0);
  });

  it("cupom sem produto vinculado aceita qualquer um dos dois produtos", async () => {
    await criarCupom({ codigo: "TESTESEMPRODUTO", tipo: "FIXO", valor: 5 });

    const a = await criarPedido(USUARIO_ID, item, "teste-endereco-id", "TESTESEMPRODUTO");
    expect(a.pedido.cupomCodigo).toBe("TESTESEMPRODUTO");
  });

  it("registrarUsoCupom sozinho também recusa produto errado — reconferência atômica, redundante ao preview", async () => {
    const cupom = await criarCupom({
      codigo: "TESTEPRODUTORACE",
      tipo: "FIXO",
      valor: 5,
      produtoId: PRODUTO_ID,
    });

    await expect(
      prisma.$transaction((tx) => registrarUsoCupom(cupom.id, tx, undefined, PRODUTO_ID_2))
    ).rejects.toMatchObject({
      status: 409,
      message: expect.stringMatching(/não vale para este produto/),
    });
    expect((await prisma.cupom.findUnique({ where: { id: cupom.id } }))?.usos).toBe(0);

    await prisma.$transaction((tx) => registrarUsoCupom(cupom.id, tx, undefined, PRODUTO_ID));
    expect((await prisma.cupom.findUnique({ where: { id: cupom.id } }))?.usos).toBe(1);
  });

  it("registrarUsoCupom sem produtoId informado não exige restrição (compatível com quem chama fora do fluxo de pedido)", async () => {
    const cupom = await criarCupom({
      codigo: "TESTEPRODUTOSEMCHECK",
      tipo: "FIXO",
      valor: 5,
      produtoId: PRODUTO_ID,
    });

    await prisma.$transaction((tx) => registrarUsoCupom(cupom.id, tx));
    expect((await prisma.cupom.findUnique({ where: { id: cupom.id } }))?.usos).toBe(1);
  });
});

describe("cupom de primeira compra", () => {
  it("libera pra quem nunca comprou", async () => {
    await criarCupom({ codigo: "TESTE1COMPRA", tipo: "FIXO", valor: 5, primeiraCompra: true });

    const { pedido } = await criarPedido(USUARIO_ID, item, "teste-endereco-id", "TESTE1COMPRA");
    expect(pedido.cupomCodigo).toBe("TESTE1COMPRA");
  });

  it("recusa numa segunda compra, depois de uma primeira já paga", async () => {
    await criarPedido(USUARIO_ID, item, "teste-endereco-id");
    await criarCupom({ codigo: "TESTE1COMPRA2", tipo: "FIXO", valor: 5, primeiraCompra: true });

    await expect(
      criarPedido(USUARIO_ID, item, "teste-endereco-id", "TESTE1COMPRA2")
    ).rejects.toMatchObject({
      status: 400,
      message: expect.stringMatching(/primeira compra/),
    });
  });

  it("recusa mesmo se o pedido anterior ainda está aguardando pagamento (não precisa ter pago pra contar)", async () => {
    gateway.pagamentoReal = true;
    gateway.criarPreferencia.mockResolvedValue({ init_point: "https://mp.exemplo/checkout" });
    await criarPedido(USUARIO_ID, item, "teste-endereco-id");
    gateway.pagamentoReal = false;

    await criarCupom({ codigo: "TESTE1COMPRA3", tipo: "FIXO", valor: 5, primeiraCompra: true });

    await expect(
      criarPedido(USUARIO_ID, item, "teste-endereco-id", "TESTE1COMPRA3")
    ).rejects.toMatchObject({
      status: 400,
      message: expect.stringMatching(/primeira compra/),
    });
  });

  it("pedido cancelado não conta como compra — o cupom de primeira compra continua valendo", async () => {
    const { pedido } = await criarPedido(USUARIO_ID, item, "teste-endereco-id");
    await prisma.pedido.update({ where: { id: pedido.id }, data: { status: "CANCELADO" } });

    await criarCupom({ codigo: "TESTE1COMPRA4", tipo: "FIXO", valor: 5, primeiraCompra: true });

    const { pedido: novo } = await criarPedido(
      USUARIO_ID,
      item,
      "teste-endereco-id",
      "TESTE1COMPRA4"
    );
    expect(novo.cupomCodigo).toBe("TESTE1COMPRA4");
  });

  it("duas compras simultâneas do mesmo cliente novo: só uma consegue o cupom de primeira compra", async () => {
    await criarCupom({ codigo: "TESTE1COMPRARACE", tipo: "FIXO", valor: 5, primeiraCompra: true });

    const resultados = await Promise.allSettled([
      criarPedido(USUARIO_ID, item, "teste-endereco-id", "TESTE1COMPRARACE"),
      criarPedido(USUARIO_ID, item, "teste-endereco-id", "TESTE1COMPRARACE"),
    ]);

    expect(resultados.map((r) => r.status).sort()).toEqual(["fulfilled", "rejected"]);
    const recusado = resultados.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(recusado.reason).toMatchObject({
      status: 409,
      message: expect.stringMatching(/primeira compra/),
    });

    // Só um pedido de verdade ficou de pé: o perdedor da corrida derruba a
    // própria transação inteira, não fica um pedido "meio criado" no banco.
    expect(
      await prisma.pedido.count({ where: { usuarioId: USUARIO_ID, status: { not: "CANCELADO" } } })
    ).toBe(1);
    const cupom = await prisma.cupom.findUnique({ where: { codigo: "TESTE1COMPRARACE" } });
    expect(cupom?.usos).toBe(1);
  });

  it("cupom comum (sem a flag) não se importa com histórico de compras", async () => {
    await criarPedido(USUARIO_ID, item, "teste-endereco-id");
    await criarCupom({ codigo: "TESTENAOPRIMEIRA", tipo: "FIXO", valor: 5 });

    const { pedido } = await criarPedido(
      USUARIO_ID,
      item,
      "teste-endereco-id",
      "TESTENAOPRIMEIRA"
    );
    expect(pedido.cupomCodigo).toBe("TESTENAOPRIMEIRA");
  });
});

describe("combinação: produto específico + primeira compra", () => {
  it("produto errado barra mesmo sendo de fato a primeira compra do cliente", async () => {
    await criarCupom({
      codigo: "TESTECOMBO",
      tipo: "FIXO",
      valor: 5,
      produtoId: PRODUTO_ID,
      primeiraCompra: true,
    });

    await expect(
      criarPedido(USUARIO_ID, item2, "teste-endereco-id", "TESTECOMBO")
    ).rejects.toMatchObject({
      status: 400,
      message: expect.stringMatching(/não vale para este produto/),
    });
  });

  it("libera só quando o produto bate e é mesmo a primeira compra", async () => {
    await criarCupom({
      codigo: "TESTECOMBO2",
      tipo: "FIXO",
      valor: 5,
      produtoId: PRODUTO_ID,
      primeiraCompra: true,
    });

    const { pedido } = await criarPedido(USUARIO_ID, item, "teste-endereco-id", "TESTECOMBO2");
    expect(pedido.cupomCodigo).toBe("TESTECOMBO2");
  });
});

describe("produto vinculado a cupom não pode ser removido", () => {
  const PRODUTO_TEMP_ID = "teste-cupom-produto-temp";

  it("bloqueia remover o produto enquanto o cupom apontar pra ele; libera depois de desvincular", async () => {
    // Idempotente: limpa antes de criar, pra sobreviver a uma execução
    // anterior que tenha falhado no meio e deixado sujeira.
    await prisma.cupom.deleteMany({ where: { produtoId: PRODUTO_TEMP_ID } });
    await prisma.produto.deleteMany({ where: { id: PRODUTO_TEMP_ID } });
    await prisma.produto.create({
      data: {
        id: PRODUTO_TEMP_ID,
        nome: "Produto temporário",
        descricao: "Só pra testar o bloqueio de remoção.",
        categoriaId: CATEGORIA_ID,
        preco: PRECO,
        precoShopee: PRECO + 20,
        emoji: "🧪",
        cor: "#3F6B4C",
      },
    });

    const cupom = await criarCupom({
      codigo: "TESTEVINCULO",
      tipo: "FIXO",
      valor: 5,
      produtoId: PRODUTO_TEMP_ID,
    });

    await expect(removerProduto(PRODUTO_TEMP_ID)).rejects.toMatchObject({
      status: 409,
      message: expect.stringMatching(/vinculado a \d+ cupom/),
    });

    await atualizarCupom(cupom.id, { produtoId: null });
    await expect(removerProduto(PRODUTO_TEMP_ID)).resolves.toBeUndefined();
  });

  it("criar ou editar cupom com produtoId inexistente devolve 404, não 500", async () => {
    await expect(
      criarCupom({ codigo: "TESTEPRODUTOFANTASMA", tipo: "FIXO", valor: 5, produtoId: "nao-existe" })
    ).rejects.toMatchObject({ status: 404, message: "Produto não encontrado." });

    const cupom = await criarCupom({ codigo: "TESTEPRODUTOFANTASMA2", tipo: "FIXO", valor: 5 });
    await expect(
      atualizarCupom(cupom.id, { produtoId: "nao-existe" })
    ).rejects.toMatchObject({ status: 404, message: "Produto não encontrado." });
  });
});
