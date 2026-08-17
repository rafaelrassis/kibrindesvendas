import "server-only";
import { StatusPedido } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ItemCarrinho } from "@/lib/cart-context";
import { ErroDeNegocio } from "./erros";
import { notificar } from "./notificacoes";

export async function criarPedido(usuarioId: string, item: ItemCarrinho) {
  const produto = await prisma.produto.findUnique({ where: { id: item.produtoId } });
  if (!produto) throw new ErroDeNegocio("Produto não encontrado.", 404);

  if (produto.requerPersonalizacao && !item.personalizacao?.aceite) {
    throw new ErroDeNegocio("Falta confirmar a personalização antes de pagar.");
  }

  // Pagamento ainda é simulado: o pedido nasce PAGO só pra o fluxo seguir até
  // a fila de produção. Quando entrar gateway de verdade isso vira
  // AGUARDANDO_PAGAMENTO até o retorno do provedor.
  return prisma.$transaction(async (tx) => {
    const pedido = await tx.pedido.create({
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
                    arteUrl: item.personalizacao.arteUrl ?? null,
                    aceiteTermos: !!item.personalizacao.aceite,
                  },
                },
              }),
            },
          ],
        },
      },
    });

    await notificar(
      usuarioId,
      "Pedido recebido!",
      produto.requerPersonalizacao
        ? `Recebemos seu pedido de ${produto.nome}. Sua arte entrou na fila de validação da nossa equipe.`
        : `Recebemos seu pedido de ${produto.nome}. Já entrou na fila de produção.`,
      tx
    );

    return pedido;
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

// Só os status que interessam ao cliente viram aviso: PAGO já é anunciado na
// criação do pedido e AGUARDANDO_PAGAMENTO é volta atrás interna.
const AVISO_POR_STATUS: Partial<Record<StatusPedido, string>> = {
  EM_PRODUCAO: "Seu pedido entrou em produção!",
  ENVIADO: "Seu pedido foi enviado.",
  ENTREGUE: "Seu pedido foi entregue. Esperamos que goste!",
  CANCELADO: "Seu pedido foi cancelado.",
};

// O status chega do corpo JSON da rota, então é texto até prova em contrário.
function validarStatus(valor: unknown): StatusPedido {
  const valores = Object.values(StatusPedido) as string[];
  if (typeof valor !== "string" || !valores.includes(valor)) {
    throw new ErroDeNegocio("Status inválido.");
  }
  return valor as StatusPedido;
}

export async function atualizarStatusPedido(id: string, statusBruto: unknown) {
  const status = validarStatus(statusBruto);

  const pedido = await prisma.pedido.findUnique({ where: { id } });
  if (!pedido) throw new ErroDeNegocio("Pedido não encontrado.", 404);

  // Reenviar o mesmo status (dois cliques no select) não gera aviso repetido.
  if (pedido.status === status) return pedido;

  return prisma.$transaction(async (tx) => {
    const atualizado = await tx.pedido.update({ where: { id }, data: { status } });

    const aviso = AVISO_POR_STATUS[status];
    if (aviso) {
      await notificar(pedido.usuarioId, "Atualização do seu pedido", aviso, tx);
    }

    return atualizado;
  });
}
