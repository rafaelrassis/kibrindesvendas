import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// O pooler do Neon (pgbouncer, modo transaction) reaproveita a mesma conexão
// de servidor entre clientes diferentes. Prepared statements nomeados do
// Prisma ficam presos a essa conexão: se o schema mudar (migration) depois
// que um plano foi cacheado, a próxima query cai em
// "cached plan must not change result type". `pgbouncer=true` faz o Prisma
// não usar prepared statements nomeados, evitando o problema.
function urlComPgbouncer(url: string | undefined) {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has("pgbouncer")) {
      parsed.searchParams.set("pgbouncer", "true");
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: urlComPgbouncer(process.env.DATABASE_URL),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
