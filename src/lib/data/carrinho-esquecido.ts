import "server-only";
import { prisma } from "@/lib/prisma";
import { baseUrl } from "@/lib/mercadopago";
import { enviarEmailCarrinhoEsquecido } from "@/lib/email";

const HORA = 60 * 60 * 1000;
// Janela do lembrete: depois de 24h parado e até 7 dias — carrinho mais velho
// que isso já esfriou, e lembrar de algo de semanas atrás só incomoda.
const PARADO_HA_HORAS = 24;
const ATE_DIAS = 7;
// Teto por execução: o cron é diário, e uma rajada de e-mails de uma vez só
// queima a reputação do remetente.
const LIMITE_POR_EXECUCAO = 100;

// Manda 1 lembrete por carrinho esquecido, para quem aceita e-mails (prefEmail).
// Não manda para quem já abriu um pedido na janela (está pagando ou pagou). O
// marcador `carrinhoLembreteEm` evita repetir; salvarCarrinho zera ele quando
// o cliente mexe no carrinho, então um carrinho novo pode avisar de novo.
export async function enviarLembretesCarrinho(agora = new Date()) {
  const parado = new Date(agora.getTime() - PARADO_HA_HORAS * HORA);
  const antigo = new Date(agora.getTime() - ATE_DIAS * 24 * HORA);

  const usuarios = await prisma.usuario.findMany({
    where: {
      prefEmail: true,
      carrinhoLembreteEm: null,
      carrinho: { some: {}, none: { updatedAt: { gt: parado } } },
      // Carrinho parado há mais de 7 dias não conta (nenhuma linha dentro da janela).
      AND: [{ carrinho: { some: { updatedAt: { gt: antigo } } } }],
      pedidos: { none: { createdAt: { gt: antigo } } },
    },
    include: { carrinho: { orderBy: { ordem: "asc" } } },
    take: LIMITE_POR_EXECUCAO,
  });

  let enviados = 0;
  for (const usuario of usuarios) {
    const produtos = await prisma.produto.findMany({
      where: { id: { in: usuario.carrinho.map((l) => l.produtoId) }, ativo: true },
      select: { id: true, nome: true },
    });
    const itens = usuario.carrinho.flatMap((l) => {
      const produto = produtos.find((p) => p.id === l.produtoId);
      return produto ? [{ nome: produto.nome, quantidade: l.quantidade }] : [];
    });

    // Marca mesmo sem itens válidos: sem isso o mesmo usuário voltaria toda
    // execução ocupando uma vaga do limite.
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { carrinhoLembreteEm: agora },
    });
    if (itens.length === 0) continue;

    await enviarEmailCarrinhoEsquecido(usuario.email, usuario.nome, itens, `${baseUrl()}/carrinho`);
    enviados += 1;
  }

  return { candidatos: usuarios.length, enviados };
}
