import { defineConfig } from "vitest/config";
import path from "path";

// Só as funções puras de `src/lib` entram aqui: nada que importe `server-only`,
// Prisma ou React. Por isso o ambiente é `node` e não há setup de DOM.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
