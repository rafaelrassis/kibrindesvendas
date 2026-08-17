import path from "node:path";
import { PrismaClient } from "@prisma/client";

// Rodamos fora do CLI do Prisma, então o .env não vem carregado de graça.
try {
  process.loadEnvFile(path.join(__dirname, "..", ".env"));
} catch {
  // sem .env local (ex.: CI/Vercel), as variaveis ja vem do ambiente
}

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const remover = process.argv.includes("--remover");

  if (!email) {
    console.error("Uso: npm run db:admin -- email@exemplo.com [--remover]");
    process.exit(1);
  }

  const usuario = await prisma.usuario.findUnique({ where: { email } });
  if (!usuario) {
    console.error(`Nenhuma conta com o e-mail ${email}. Cadastre em /cadastro primeiro.`);
    process.exit(1);
  }

  await prisma.usuario.update({
    where: { email },
    data: { admin: !remover },
  });

  console.log(
    remover
      ? `🔓 ${email} não é mais admin.`
      : `🔑 ${email} agora é admin — acesse /admin/produtos.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
