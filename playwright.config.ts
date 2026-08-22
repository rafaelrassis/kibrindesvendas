import { defineConfig, devices } from "@playwright/test";

// E2E do fluxo de compra de ponta a ponta (produto → checkout → pagamento →
// confirmação). Roda contra `next dev` com o mesmo Postgres seedado usado
// pelos testes de integração — sem MERCADOPAGO_ACCESS_TOKEN configurado, o
// pagamento fica em modo simulado (aprova na hora), então a suíte não depende
// do Mercado Pago de verdade nem de um webhook.
//
// `PLAYWRIGHT_CHROMIUM_EXECUTABLE`, se definida, aponta pro binário do
// Chromium a usar em vez do gerenciado pelo Playwright — útil em ambiente que
// já traz um Chromium instalado numa revisão diferente da que este
// `@playwright/test` pede.
const executavelChromium = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]]
    : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(executavelChromium && { launchOptions: { executablePath: executavelChromium } }),
      },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
