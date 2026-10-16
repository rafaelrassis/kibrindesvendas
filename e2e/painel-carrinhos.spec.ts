import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { cpfValidoAleatorio } from "./helpers";

// E2E da seção 9 ("Painel /admin/carrinhos") do spec de testes do carrinho:
// controle de acesso, renderização básica, exportação CSV e a lista de
// carrinhos parados (Chamar / Marcar resolvido). Os testes estatísticos do
// A/B e o funil (que dependem de volume e de dados inseridos via SQL) ficam
// fora — são de leitura, não de fluxo.
const PRODUTO_ID = "camiseta-basica-01";
const prisma = new PrismaClient();

test.describe("acesso ao painel", () => {
  test("sem login redireciona pro /entrar", async ({ page }) => {
    await page.goto("/admin/carrinhos");
    await expect(page).toHaveURL(/\/entrar\?next=/);
  });

  test("logado sem ser admin redireciona pro /restrito", async ({ page }) => {
    const email = `e2e-painel-comum-${Date.now()}@example.com`;
    try {
      await page.goto("/cadastro");
      await page.getByLabel("Nome").fill("Cliente E2E Painel");
      await page.getByLabel("E-mail").fill(email);
      await page.getByLabel("Telefone / WhatsApp").fill("(11) 91234-5678");
      await page.getByLabel("CPF").fill(cpfValidoAleatorio());
      await page.getByLabel("Senha").fill("senha123456");
      await page.getByRole("button", { name: "Criar conta" }).click();
      await expect(page).toHaveURL(/\/conta$/);

      await page.goto("/admin/carrinhos");
      await expect(page).toHaveURL(/\/restrito$/);
    } finally {
      const usuario = await prisma.usuario.findUnique({ where: { email } });
      if (usuario) await prisma.usuario.delete({ where: { id: usuario.id } });
    }
  });

  test("rotas /api/admin/carrinhos exigem admin", async ({ page }) => {
    const semSessao = await page.request.get("/api/admin/carrinhos/exportar");
    expect(semSessao.status()).toBe(401);
  });
});

test.describe.serial("painel /admin/carrinhos (admin)", () => {
  const emailAdmin = `e2e-painel-admin-${Date.now()}@example.com`;
  const emailCliente = `e2e-painel-cliente-${Date.now()}@example.com`;
  let page: Page;
  let clienteId: string;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto("/cadastro");
    await page.getByLabel("Nome").fill("Admin E2E Painel");
    await page.getByLabel("E-mail").fill(emailAdmin);
    await page.getByLabel("Telefone / WhatsApp").fill("(11) 90000-0000");
    await page.getByLabel("CPF").fill(cpfValidoAleatorio());
    await page.getByLabel("Senha").fill("senha123456");
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page).toHaveURL(/\/conta$/);
    await prisma.usuario.update({ where: { email: emailAdmin }, data: { admin: true } });

    // Cliente com carrinho parado há mais de 24h, criado direto no banco: o
    // campo `updatedAt` de CarrinhoItem é `@updatedAt` (gerenciado pelo
    // Prisma), então só um UPDATE SQL cru consegue "voltar no tempo" — é
    // exatamente o que a seção 7 do spec pede pra simular o cron.
    const cliente = await prisma.usuario.create({
      data: {
        nome: "Cliente Parado E2E",
        email: emailCliente,
        senhaHash: "x",
        telefone: "(11) 91234-5678",
        prefWhatsapp: true,
      },
    });
    clienteId = cliente.id;
    const item = await prisma.carrinhoItem.create({
      data: {
        usuarioId: cliente.id,
        chave: "linha-1",
        produtoId: PRODUTO_ID,
        variacoesEscolhidas: { Tamanho: "M", Cor: "Branca" },
        quantidade: 1,
      },
    });
    const horas25AtrasSql = new Date(Date.now() - 25 * 60 * 60 * 1000);
    await prisma.$executeRaw`UPDATE "CarrinhoItem" SET "updatedAt" = ${horas25AtrasSql} WHERE id = ${item.id}`;
  });

  test.afterAll(async () => {
    await page.close();
    await prisma.resolvidoCarrinho.deleteMany({ where: { usuarioId: clienteId } });
    await prisma.contatoCarrinho.deleteMany({ where: { usuarioId: clienteId } });
    await prisma.carrinhoItem.deleteMany({ where: { usuarioId: clienteId } });
    await prisma.usuario.deleteMany({ where: { id: { in: [clienteId] } } });
    const admin = await prisma.usuario.findUnique({ where: { email: emailAdmin } });
    if (admin) await prisma.usuario.delete({ where: { id: admin.id } });
    await prisma.$disconnect();
  });

  test("renderiza cards e troca de período", async () => {
    await page.goto("/admin/carrinhos");
    await expect(page.getByRole("heading", { name: "Carrinhos", exact: true })).toBeVisible();
    await expect(page.getByText("Carrinhos ativos")).toBeVisible();
    await expect(page.getByText("Parados há 24h+")).toBeVisible();
    await expect(page.getByText("Lembretes enviados").first()).toBeVisible();
    await expect(page.getByText("Taxa de recuperação")).toBeVisible();

    await page.getByRole("link", { name: "90 dias" }).click();
    await expect(page).toHaveURL(/dias=90/);
    await expect(page.getByRole("heading", { name: "Carrinhos", exact: true })).toBeVisible();

    await page.getByRole("link", { name: "7 dias" }).click();
    await expect(page).toHaveURL(/dias=7/);
  });

  test("exporta CSV com BOM e cabeçalho esperado", async () => {
    const resposta = await page.request.get("/api/admin/carrinhos/exportar?dias=30");
    expect(resposta.status()).toBe(200);
    expect(resposta.headers()["content-disposition"]).toContain(
      'filename="lembretes-carrinho-30d.csv"'
    );
    const corpo = await resposta.text();
    expect(corpo.charCodeAt(0)).toBe(0xfeff); // BOM
    expect(corpo).toContain(
      "enviado_em,tipo,variante_assunto,variante_desconto,cupom,valor_carrinho,recuperado,receita"
    );
  });

  test("lista carrinhos parados com Chamar e Marcar resolvido", async () => {
    await page.goto("/admin/carrinhos");
    const linha = page.locator("tr", { hasText: emailCliente });
    await expect(linha).toBeVisible();
    await expect(linha).toContainText("Cliente Parado E2E");
    await expect(linha).toContainText("25h");

    const chamar = linha.getByRole("link", { name: "Chamar" });
    await expect(chamar).toBeVisible();
    await expect(chamar).toHaveAttribute("href", /^https:\/\/wa\.me\/5511912345678\?text=/);
    // Antes de qualquer contato, não há "Marcar resolvido" pra essa linha.
    await expect(linha.getByRole("button", { name: "Marcar resolvido" })).toHaveCount(0);

    // Em vez de clicar em "Chamar" (abre uma aba nova de verdade pro
    // WhatsApp), chama a mesma API que o clique dispara — o componente é só
    // um <a> com um fetch no onClick, então isso testa o mesmo caminho.
    const contato = await page.request.post("/api/admin/carrinhos/contato", {
      data: { usuarioId: clienteId },
    });
    expect(contato.ok()).toBe(true);

    await page.goto("/admin/carrinhos");
    const linhaContatada = page.locator("tr", { hasText: emailCliente });
    await expect(linhaContatada).toContainText("contatado há");
    const resolver = linhaContatada.getByRole("button", { name: "Marcar resolvido" });
    await expect(resolver).toBeVisible();

    await resolver.click();
    await expect(page.locator("tr", { hasText: emailCliente })).toHaveCount(0);
  });
});
