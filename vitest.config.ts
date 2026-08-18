import { defineConfig, configDefaults } from "vitest/config";
import path from "path";

// Só as funções puras de `src/lib` entram aqui: nada que importe `server-only`,
// Prisma ou React. Por isso o ambiente é `node` e não há setup de DOM.
// O que precisa de banco fica em `*.integration.test.ts`, numa suíte à parte
// (vitest.config.integration.ts, `npm run test:db`).
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: [...configDefaults.exclude, "src/**/*.integration.test.ts"],
  },
});
