import { PrismaClient } from "@prisma/client";
import { categorias, produtos } from "../src/lib/mock-data";

const prisma = new PrismaClient();

async function main() {
  for (const c of categorias) {
    await prisma.categoria.upsert({
      where: { slug: c.slug },
      update: {},
      create: c,
    });
  }

  for (const p of produtos) {
    const categoria = await prisma.categoria.findUnique({ where: { slug: p.categoria } });
    if (!categoria) continue;

    await prisma.produto.upsert({
      where: { id: p.id },
      update: {},
      create: {
        id: p.id,
        nome: p.nome,
        descricao: p.descricao,
        categoriaId: categoria.id,
        preco: p.preco,
        precoShopee: p.precoShopee,
        requerPersonalizacao: p.requerPersonalizacao,
        emoji: p.emoji,
        cor: p.cor,
        destaque: p.destaque ?? false,
        variacoes: {
          create: p.variacoes.map((v) => ({ tipo: v.tipo, valores: v.valores })),
        },
      },
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
