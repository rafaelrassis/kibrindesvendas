import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

// Fluxo completo de compra, de ponta a ponta, contra o Postgres seedado
// (mesmo produto do mock-data: "Camiseta Básica Algodão", sem
// personalização). Sem MERCADOPAGO_ACCESS_TOKEN no ambiente de teste, o
// pagamento é simulado — o pedido nasce PAGO na hora, sem depender do
// Mercado Pago nem do webhook.
const PRODUTO_ID = "camiseta-basica-01";

// Dígito verificador do CPF (mesmo algoritmo de src/lib/cpf.ts), pra gerar um
// número válido por execução sem colidir com o de uma execução anterior — o
// campo é único por conta.
function digitoVerificador(base: string): number {
  let soma = 0;
  let peso = base.length + 1;
  for (const c of base) {
    soma += Number(c) * peso;
    peso--;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

function cpfValidoAleatorio(): string {
  // 111111111 (e outras sequências repetidas) é rejeitado de propósito pela
  // validação — soma um índice crescente aos 9 primeiros dígitos evita cair
  // numa sequência dessas.
  const base = Array.from({ length: 9 }, (_, i) => (i + Math.floor(Math.random() * 8) + 1) % 10).join(
    ""
  );
  const d1 = digitoVerificador(base);
  const d2 = digitoVerificador(base + d1);
  return `${base}${d1}${d2}`;
}

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

  test("cadastro → produto → checkout → endereço obrigatório → pagamento simulado → confirmação", async ({
    page,
  }) => {
    await page.goto("/cadastro");
    await page.getByLabel("Nome").fill("Cliente E2E");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("CPF").fill(cpf);
    await page.getByLabel("Senha").fill("senha123456");
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page).toHaveURL(/\/conta$/);

    await page.goto(`/produto/${PRODUTO_ID}`);
    await page.getByRole("button", { name: "M", exact: true }).click();
    await page.getByRole("button", { name: "Branca", exact: true }).click();
    await page.getByPlaceholder("00000-000").fill("01310-100");
    // O CEP solto aqui é só pra prévia do frete na própria página do produto
    // — continua funcionando sem endereço nenhum cadastrado.
    await expect(page.getByText("Receba em até")).toBeVisible({ timeout: 15_000 });

    await page.locator('button:has-text("⚡ Comprar agora")').last().click();
    await expect(page).toHaveURL(/\/checkout$/);

    await expect(page.getByText("Camiseta Básica Algodão")).toBeVisible();

    // Conta nova, sem endereço salvo: finalizar a compra tem que cair no
    // cadastro de endereço em vez de deixar seguir só com o CEP da prévia.
    const botaoPagarAntes = page.getByRole("button", { name: /^Pagar R\$/ });
    await expect(botaoPagarAntes).toBeDisabled();
    await expect(page.getByText("Você ainda não tem um endereço cadastrado.")).toBeVisible();
    await page.getByRole("button", { name: "Cadastrar endereço" }).click();
    await expect(page).toHaveURL(/\/conta\/enderecos\/novo\?next=\/checkout$/);

    await page.getByLabel("Identificação (ex: Casa, Trabalho)").fill("Casa");
    await page.getByLabel("Destinatário").fill("Cliente E2E");
    await page.getByLabel("CEP", { exact: true }).fill("01310-100");
    await page.getByLabel("Número").fill("1000");
    // Rua/Bairro/Cidade/UF vêm preenchidos pelo ViaCEP a partir do CEP acima;
    // só confere que o preenchimento aconteceu antes de salvar.
    await expect(page.getByLabel("Rua")).not.toHaveValue("");
    await page.getByRole("button", { name: "Salvar endereço" }).click();

    // `next=/checkout` traz de volta pro checkout, com o endereço recém
    // criado já selecionado (é o único, vira padrão automaticamente).
    await expect(page).toHaveURL(/\/checkout$/);
    await expect(page.getByText("Cliente E2E")).toBeVisible();

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
