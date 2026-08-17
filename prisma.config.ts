import path from "node:path";
import { defineConfig } from "prisma/config";

// Com prisma.config.ts o CLI nao carrega mais o .env sozinho.
try {
  process.loadEnvFile(path.join(__dirname, ".env"));
} catch {
  // sem .env local (ex.: CI/Vercel), as variaveis ja vem do ambiente
}

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
