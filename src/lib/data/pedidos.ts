import "server-only";
import { prisma } from "@/lib/prisma";
import type { ItemCarrinho } from "@/lib/cart-context";
import { ErroDeNegocio } from "./erros";

export async function criarPedido(usuarioId: string, item: ItemCarrinho) {
  const produto = await prisma.produto.findUnique({ where: { id: item.produtoId } });
  if (!produto) throw new ErroDeNegocio("Produto não encontrado.", 404);

  if (produto.requerPersonalizacao && !item.personalizacao?.aceite) {
    throw new ErroDeNegocio("Falta confirmar a personalização antes de pagar.");
  }

  // Pagamento ainda é simulado: o pedido nasce PAGO só pra o fluxo seguir até
  // a fila de produção. Quando entrar gateway de verdade isso vira
  // AGUARDANDO_PAGAMENTO até o retorno do provedor.
  return prisma.pedido.create({
    data: {
      usuarioId,
      status: "PAGO",
      total: produto.preco,
      pagamentoMock: true,
      itens: {
        create: [
          {
            produtoId: produto.id,
            quantidade: 1,
            precoUnitario: produto.preco,
            variacaoEscolhida: item.variacoesEscolhidas ?? {},
            ...(item.personalizacao && {
              personalizacao: {
                create: {
                  tipo: item.personalizacao.via,
                  briefing: item.personalizacao.resumo,
                  aceiteTermos: !!item.personalizacao.aceite,
                },
              },
            }),
          },
        ],
      },
    },
  });
}

export async function getPedidosRecentes(limite = 50) {
  return prisma.pedido.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      usuario: true,
      itens: { include: { produto: true, personalizacao: true } },
    },
    take: limite,
  });
}
