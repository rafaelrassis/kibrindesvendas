import { defineConfig } from "vitest/config";
import path from "path";

// Suíte que precisa de Postgres de verdade: as regras do cupom que só o banco
// garante (o limite atômico sob concorrência, a devolução do uso, as CHECK
// constraints) não dá pra exercitar com função pura. Fica fora do `npm test`
// de propósito — aquele roda em segundos, sem infraestrutura nenhuma.
//
// Rodar com `npm run test:db`, com DATABASE_URL apontando pra um banco
// descartável e já migrado (`npm run db:deploy`). A suíte cria e apaga as
// próprias linhas, todas prefixadas por "teste-cupom"/"TESTE".
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // `server-only` estoura de propósito ao ser importado fora do bundler do
      // Next; o próprio pacote traz o módulo vazio que o React Server usa no
      // lugar dele, e é ele que entra aqui.
      "server-only": path.resolve(__dirname, "./node_modules/server-only/empty.js"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    // Um arquivo por vez: todos mexem nas mesmas tabelas e um limparia o
    // cenário do outro no meio do caminho.
    fileParallelism: false,
  },
});
