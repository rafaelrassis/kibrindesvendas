import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { cpfValidoAleatorio } from "./helpers";

// Fluxo completo de compra, de ponta a ponta, contra o Postgres seedado
// (mesmo produto do mock-data: "Camiseta Básica Algodão", sem
// personalização). Sem MERCADOPAGO_ACCESS_TOKEN no ambiente de teste, o
// pagamento é simulado — o pedido nasce PAGO na hora, sem depender do
// Mercado Pago nem do webhook.
const PRODUTO_ID = "camiseta-basica-01";

const prisma = new PrismaClient();

test.describe("compra de ponta a ponta", () => {
  const email = `e2e-compra-${Date.now()}@example.com`;
  const cpf = cpfValidoAleatorio();

  test.afterAll(async () => {
    const usuario = await prisma.usuario.findUnique({ where: { email } });
    if (usuario) {
      await prisma.pedido.deleteMany({ where: { usuarioId: usuario.id } });
      await prisma.notificacao.deleteMany({ where: { usuarioId: usuario.id } });
      await prisma.carrinhoItem.deleteMany({ where: { usuarioId: usuario.id } });
      await prisma.usuario.delete({ where: { id: usuario.id } });
    }
    await prisma.$disconnect();
  });

  test("cadastro → produto → checkout → pagamento simulado → confirmação", async ({ page }) => {
    await page.goto("/cadastro");
    await page.getByLabel("Nome").fill("Cliente E2E");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Telefone / WhatsApp").fill("(11) 91234-5678");
    await page.getByLabel("CPF").fill(cpf);
    await page.getByLabel("Senha").fill("senha123456");
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page).toHaveURL(/\/conta$/);

    await page.goto(`/produto/${PRODUTO_ID}`);
    await page.getByRole("button", { name: "M", exact: true }).click();
    await page.getByRole("button", { name: "Branca", exact: true }).click();
    await page.getByPlaceholder("00000-000").fill("01310-100");
    // Confirma que o frete calculou antes de seguir — sem isso o botão de
    // pagar no checkout continua desabilitado esperando o mesmo cálculo.
    await expect(page.getByText("Receba em até")).toBeVisible({ timeout: 15_000 });

    await page.locator('button:has-text("⚡ Comprar agora")').last().click();
    await expect(page).toHaveURL(/\/checkout$/);

    await expect(page.getByText("Camiseta Básica Algodão")).toBeVisible();

    // Primeira compra: sem endereço salvo, o checkout abre o formulário de
    // cadastro sozinho — endereço virou obrigatório pra fechar o pedido.
    await page.getByLabel("Identificação (ex: Casa, Trabalho)").fill("Casa");
    await page.getByLabel("Destinatário").fill("Cliente E2E");
    await page.getByLabel("CEP", { exact: true }).fill("01310-100");
    await page.getByLabel("Número").fill("1000");
    await page.getByLabel("Rua").fill("Av. Paulista");
    await page.getByLabel("Bairro").fill("Bela Vista");
    await page.getByLabel("Cidade").fill("São Paulo");
    await page.getByLabel("UF").fill("SP");
    await page.getByRole("button", { name: "Salvar endereço" }).click();

    const botaoPagar = page.getByRole("button", { name: /^Pagar R\$/ });
    await expect(botaoPagar).toBeEnabled({ timeout: 15_000 });
    await botaoPagar.click();

    await expect(page).toHaveURL(/\/pedido\/confirmado\?id=/, { timeout: 15_000 });
    await expect(page.getByText("Pedido confirmado!")).toBeVisible();

    // A sacola só é esvaziada quando o pagamento é confirmado (ver
    // LimparCarrinhoAoConfirmar) — no modo simulado isso já acontece na
    // primeira renderização desta página, então voltar ao checkout deve
    // mostrar a sacola vazia em vez do item de novo.
    await page.goto("/checkout");
    await expect(page.getByText("Seu carrinho está vazio.")).toBeVisible();

    await page.goto("/conta/pedidos");
    const linkDoPedido = page.getByRole("link", { name: /Pedido #/ }).first();
    await expect(linkDoPedido.getByText("Pago", { exact: true })).toBeVisible();

    await linkDoPedido.click();
    await expect(page.getByText("Camiseta Básica Algodão")).toBeVisible();
  });
});
