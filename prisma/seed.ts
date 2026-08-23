import { PrismaClient } from "@prisma/client";
import { banners, categorias, faqs, produtos } from "../src/lib/mock-data";

const prisma = new PrismaClient();

async function main() {
  for (const c of categorias) {
    await prisma.categoria.upsert({
      where: { slug: c.slug },
      update: {},
      create: c,
    });
  }

  // `update: {}` de propósito: o que a loja editar em /admin/banners não pode
  // voltar atrás se o seed rodar de novo.
  for (const b of banners) {
    await prisma.banner.upsert({
      where: { id: b.id },
      update: {},
      create: b,
    });
  }

  // Mesmo raciocínio do banner: seed só cria a FAQ na primeira vez, edição
  // feita em /admin/faqs não é sobrescrita se o seed rodar de novo.
  for (const f of faqs) {
    await prisma.faq.upsert({
      where: { id: f.id },
      update: {},
      create: f,
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
        vendidoNaShopee: p.vendidoNaShopee,
        requerPersonalizacao: p.requerPersonalizacao,
        mensagemPersonalizacao: p.mensagemPersonalizacao,
        diasProducaoExtra: p.diasProducaoExtra,
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
