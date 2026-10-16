import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { cpfValidoAleatorio, PNG_1X1_BASE64 } from "./helpers";

// E2E da seção 2 ("Carrinho multi-item") do spec de testes do carrinho.
// Produto existente no seed (sem personalização, com variações) e produtos
// de teste criados no beforeAll só pra esta suíte — isolados por um prefixo
// no id, apagados no afterAll.
const PRODUTO_BASICO = "camiseta-basica-01";
const ID_A = "e2e-carrinho-produto-a";
const ID_B = "e2e-carrinho-produto-b";
const ID_ESTOQUE = "e2e-carrinho-produto-estoque";
const ID_PERSONALIZADO = "e2e-carrinho-produto-personalizado";
const IDS_TESTE = [ID_A, ID_B, ID_ESTOQUE, ID_PERSONALIZADO];
const NOME_A = "E2E Produto A";
const NOME_B = "E2E Produto B";
const NOME_ESTOQUE = "E2E Produto com Estoque";
const NOME_PERSONALIZADO = "E2E Produto Personalizado";

const prisma = new PrismaClient();

// Produtos de teste e config de frete grátis são compartilhados pelo arquivo
// inteiro (inclusive o teste solto 2.7, fora do describe.serial) — setup e
// limpeza ficam num beforeAll/afterAll de topo pra não serem apagados antes
// da hora.
let freteGratisOriginal: string | null;

test.beforeAll(async () => {
  const categoria = await prisma.categoria.findUnique({ where: { slug: "camisetas" } });
  if (!categoria) throw new Error("Categoria 'camisetas' não encontrada — rode o seed antes.");

  await prisma.produto.upsert({
    where: { id: ID_A },
    update: { preco: 50, estoque: null, requerPersonalizacao: false },
    create: {
      id: ID_A,
      nome: NOME_A,
      descricao: "Produto de teste e2e.",
      categoriaId: categoria.id,
      preco: 50,
      precoShopee: 50,
      emoji: "🧪",
      cor: "#2E4A3D",
    },
  });
  await prisma.produto.upsert({
    where: { id: ID_B },
    update: { preco: 60, estoque: null, requerPersonalizacao: false },
    create: {
      id: ID_B,
      nome: NOME_B,
      descricao: "Produto de teste e2e.",
      categoriaId: categoria.id,
      preco: 60,
      precoShopee: 60,
      emoji: "🧪",
      cor: "#2E4A3D",
    },
  });
  await prisma.produto.upsert({
    where: { id: ID_ESTOQUE },
    update: { preco: 40, estoque: 2, requerPersonalizacao: false },
    create: {
      id: ID_ESTOQUE,
      nome: NOME_ESTOQUE,
      descricao: "Produto de teste e2e.",
      categoriaId: categoria.id,
      preco: 40,
      precoShopee: 40,
      estoque: 2,
      emoji: "🧪",
      cor: "#2E4A3D",
    },
  });
  await prisma.produto.upsert({
    where: { id: ID_PERSONALIZADO },
    update: { preco: 70, estoque: null, requerPersonalizacao: true },
    create: {
      id: ID_PERSONALIZADO,
      nome: NOME_PERSONALIZADO,
      descricao: "Produto de teste e2e.",
      categoriaId: categoria.id,
      preco: 70,
      precoShopee: 70,
      requerPersonalizacao: true,
      emoji: "🧪",
      cor: "#2E4A3D",
    },
  });

  const configAtual = await prisma.configuracaoLoja.findUnique({ where: { id: "singleton" } });
  freteGratisOriginal = configAtual?.freteGratisAcimaDe?.toString() ?? null;
});

test.afterAll(async () => {
  await prisma.configuracaoLoja.upsert({
    where: { id: "singleton" },
    update: { freteGratisAcimaDe: freteGratisOriginal },
    create: { id: "singleton", freteGratisAcimaDe: freteGratisOriginal },
  });
  await prisma.produto.deleteMany({ where: { id: { in: IDS_TESTE } } });
  await prisma.$disconnect();
});

test.describe.serial("carrinho multi-item (logado)", () => {
  const email = `e2e-carrinho-${Date.now()}@example.com`;
  const cpf = cpfValidoAleatorio();
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto("/cadastro");
    await page.getByLabel("Nome").fill("Cliente E2E Carrinho");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Telefone / WhatsApp").fill("(11) 91234-5678");
    await page.getByLabel("CPF").fill(cpf);
    await page.getByLabel("Senha").fill("senha123456");
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page).toHaveURL(/\/conta$/);
  });

  test.afterAll(async () => {
    await page.close();
    const usuario = await prisma.usuario.findUnique({ where: { email } });
    if (usuario) {
      await prisma.notificacao.deleteMany({ where: { usuarioId: usuario.id } });
      await prisma.carrinhoItem.deleteMany({ where: { usuarioId: usuario.id } });
      await prisma.usuario.delete({ where: { id: usuario.id } });
    }
  });

  test("2.1/2.2 — adiciona produtos diferentes e mescla a mesma linha", async () => {
    await page.goto(`/produto/${PRODUTO_BASICO}`);
    await page.getByRole("button", { name: "M", exact: true }).click();
    await page.getByRole("button", { name: "Branca", exact: true }).click();
    await page.getByRole("button", { name: "🛒 Adicionar ao carrinho" }).click();
    await expect(page.getByText("✓ Adicionado ao carrinho.")).toBeVisible();
    // No desktop, adicionar abre o mini-carrinho por cima do botão — fecha
    // antes de clicar de novo na mesma página, senão o overlay bloqueia.
    await page.keyboard.press("Escape");

    // Mesmo produto, mesma variação de novo — mescla na mesma linha em vez
    // de criar uma segunda.
    await page.getByRole("button", { name: "🛒 Adicionar ao carrinho" }).click();
    await expect(page.getByText("✓ Adicionado ao carrinho.")).toBeVisible();

    await page.goto(`/produto/${ID_A}`);
    await page.getByRole("button", { name: "🛒 Adicionar ao carrinho" }).click();

    await page.goto(`/produto/${ID_B}`);
    await page.getByRole("button", { name: "🛒 Adicionar ao carrinho" }).click();

    // Contador do header: 2 (camiseta mesclada) + 1 + 1 = 4 unidades.
    await expect(page.getByRole("button", { name: "Carrinho, 4 item(ns)" })).toBeVisible();

    await page.goto("/carrinho");
    await expect(page.getByRole("heading", { name: "Carrinho", exact: true })).toBeVisible();
    // 3 linhas distintas: a mesclagem não criou uma quarta.
    await expect(page.getByRole("button", { name: /^Remover .* do carrinho$/ })).toHaveCount(3);

    const diminuirCamiseta = page.getByLabel("Diminuir quantidade de Camiseta Básica Algodão");
    await expect(diminuirCamiseta.locator("xpath=following-sibling::span[1]")).toHaveText("2");
  });

  test("2.3 — produto com personalização: 1 unidade por linha, cada adição é uma linha nova", async () => {
    for (let i = 0; i < 2; i++) {
      await page.goto(`/produto/${ID_PERSONALIZADO}`);
      await page.getByRole("button", { name: "Avançar para personalização" }).click();
      await expect(page).toHaveURL(new RegExp(`/personalizar/${ID_PERSONALIZADO}$`));

      await page
        .locator('input[type="file"]')
        .setInputFiles({
          name: "arte.png",
          mimeType: "image/png",
          buffer: Buffer.from(PNG_1X1_BASE64, "base64"),
        });
      await expect(page.getByText("✓ Arquivo enviado com sucesso.")).toBeVisible({
        timeout: 15_000,
      });
      await page.getByLabel(/Confirmo que a arte enviada/).check();
      await page.getByRole("button", { name: "Confirmar arte e ir pro carrinho" }).click();
      await expect(page).toHaveURL(/\/carrinho$/);
    }

    const linhasDoProduto = page.getByRole("link", { name: NOME_PERSONALIZADO });
    await expect(linhasDoProduto).toHaveCount(2);
    // Sem seletor de quantidade: fica travado em 1 (QuantidadeItem não
    // renderiza nada pra produto com requerPersonalizacao).
    await expect(page.getByLabel(new RegExp(`quantidade de ${NOME_PERSONALIZADO}`, "i"))).toHaveCount(
      0
    );
    await expect(page.getByText(/Arte enviada pelo cliente/)).toHaveCount(2);
  });

  test("2.4 — aumentar além do estoque: botão + bloqueia no máximo e avisa", async () => {
    await page.goto(`/produto/${ID_ESTOQUE}`);
    const aumentar = page.getByLabel("Aumentar quantidade", { exact: true });
    await aumentar.click(); // 1 → 2 (estoque total do produto)
    await expect(aumentar).toBeDisabled();
    await expect(page.getByText("Máximo disponível em estoque.")).toBeVisible();

    await page.getByRole("button", { name: "🛒 Adicionar ao carrinho" }).click();
    await expect(page.getByText("✓ Adicionado ao carrinho.")).toBeVisible();

    await page.goto("/carrinho");
    await expect(page.getByText("Últimas 2 unidade(s) em estoque.")).toBeVisible();
    await expect(page.getByLabel(`Aumentar quantidade de ${NOME_ESTOQUE}`)).toBeDisabled();
  });

  test("2.5 — preço mudou no admin aparece como aviso no carrinho", async () => {
    await prisma.produto.update({ where: { id: ID_A }, data: { preco: 80 } });

    await page.goto("/carrinho");
    await expect(
      page.getByText("O preço mudou de R$ 50,00 para R$ 80,00.")
    ).toBeVisible();

    await page.getByRole("button", { name: "Ok, entendi" }).click();
    await expect(page.getByText("O preço mudou de")).toHaveCount(0);
  });

  test("2.6 — barra de frete grátis mostra quanto falta e some ao passar do limite", async () => {
    await page.goto("/carrinho");

    // Limite acima do subtotal atual: a barra mostra quanto falta.
    await prisma.configuracaoLoja.upsert({
      where: { id: "singleton" },
      update: { freteGratisAcimaDe: 100000 },
      create: { id: "singleton", freteGratisAcimaDe: 100000 },
    });
    await page.reload();
    await expect(page.getByText(/Faltam R\$ .* pra ganhar frete grátis\./)).toBeVisible();

    // Limite abaixo do subtotal atual: frete grátis garantido.
    await prisma.configuracaoLoja.update({ where: { id: "singleton" }, data: { freteGratisAcimaDe: 1 } });
    await page.reload();
    await expect(page.getByText("🎉 Você ganhou frete grátis!")).toBeVisible();
  });

  test("2.8 — remover item limpa o banco e reabre o lembrete de carrinho esquecido", async () => {
    const usuario = await prisma.usuario.findUniqueOrThrow({ where: { email } });
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { carrinhoLembreteEm: new Date(), carrinhoLembrete2Em: new Date() },
    });

    await page.goto("/carrinho");
    const antes = await prisma.carrinhoItem.count({ where: { usuarioId: usuario.id } });
    expect(antes).toBeGreaterThan(0);

    await page.getByRole("button", { name: `Remover ${NOME_B} do carrinho` }).click();
    await expect(page.getByRole("link", { name: NOME_B })).toHaveCount(0);

    await expect
      .poll(async () => prisma.carrinhoItem.count({ where: { usuarioId: usuario.id } }))
      .toBe(antes - 1);

    const usuarioDepois = await prisma.usuario.findUniqueOrThrow({ where: { id: usuario.id } });
    expect(usuarioDepois.carrinhoLembreteEm).toBeNull();
    expect(usuarioDepois.carrinhoLembrete2Em).toBeNull();

    // Esvazia o resto removendo linha por linha (não existe botão "limpar
    // tudo" na tela — a sacola some sozinha quando a última linha sai).
    // Remover uma linha muda a lista de produtos buscados (useProdutos) e a
    // tela passa por um "Carregando..." instantâneo entre as linhas — espera
    // sumir antes de contar ou clicar de novo, senão a contagem pode pegar
    // esse instante sem nenhum botão "Remover" na tela.
    const carregando = page.getByText("Carregando...");
    const botoesRemover = page.getByRole("button", { name: /^Remover .* do carrinho$/ });
    await expect(carregando).toHaveCount(0);
    let restantes = await botoesRemover.count();
    while (restantes > 0) {
      await botoesRemover.first().click();
      await expect(carregando).toHaveCount(0);
      await expect(botoesRemover).toHaveCount(restantes - 1);
      restantes -= 1;
    }
    await expect(page.getByRole("heading", { name: "Seu carrinho está vazio" })).toBeVisible();
    await expect
      .poll(async () => prisma.carrinhoItem.count({ where: { usuarioId: usuario.id } }))
      .toBe(0);
  });

  test("2.9 — mais de 30 linhas via PUT /api/carrinho devolve 400", async () => {
    const itens = Array.from({ length: 31 }, (_, i) => ({
      id: `linha-${i}`,
      produtoId: ID_A,
      variacoesEscolhidas: {},
      quantidade: 1,
    }));
    const resposta = await page.request.put("/api/carrinho", { data: { itens } });
    expect(resposta.status()).toBe(400);
    const corpo = await resposta.json();
    expect(corpo.error).toBe("O carrinho aceita no máximo 30 itens.");
  });
});

test("2.7 — login com carrinho local sobe pro servidor", async ({ page }) => {
  const email = `e2e-carrinho-login-${Date.now()}@example.com`;
  const cpf = cpfValidoAleatorio();

  try {
    // Visitante (sem login) adiciona um item — fica só no localStorage.
    await page.goto(`/produto/${ID_A}`);
    await page.getByRole("button", { name: "🛒 Adicionar ao carrinho" }).click();
    await expect(page.getByRole("button", { name: "Carrinho, 1 item(ns)" })).toBeVisible();

    await page.goto("/cadastro");
    await page.getByLabel("Nome").fill("Cliente E2E Login");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Telefone / WhatsApp").fill("(11) 91234-5678");
    await page.getByLabel("CPF").fill(cpf);
    await page.getByLabel("Senha").fill("senha123456");
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page).toHaveURL(/\/conta$/);

    // O carrinho local sobe pro banco (cart-context sincroniza no primeiro
    // login) — confirmado pela própria API, sem depender de layout de tela.
    await expect
      .poll(async () => {
        const resposta = await page.request.get("/api/carrinho");
        const corpo = (await resposta.json()) as Array<{ produtoId: string }>;
        return corpo.some((i) => i.produtoId === ID_A);
      })
      .toBe(true);

    await page.goto("/carrinho");
    await expect(page.getByRole("link", { name: NOME_A })).toBeVisible();
  } finally {
    const usuario = await prisma.usuario.findUnique({ where: { email } });
    if (usuario) {
      await prisma.carrinhoItem.deleteMany({ where: { usuarioId: usuario.id } });
      await prisma.usuario.delete({ where: { id: usuario.id } });
    }
  }
});
