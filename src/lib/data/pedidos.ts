import "server-only";
import { StatusPedido } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ItemCarrinho } from "@/lib/cart-context";
import {
  baseUrl,
  pagamentoRealConfigurado,
  paymentClient,
  preferenceClient,
} from "@/lib/mercadopago";
import { ErroDeNegocio } from "./erros";
import { notificar } from "./notificacoes";

// Cria o pedido e devolve pra onde mandar o cliente em seguida: a página
// hospedada do Mercado Pago quando o pagamento é real, ou direto a tela de
// confirmação no modo simulado.
export async function criarPedido(usuarioId: string, item: ItemCarrinho) {
  const [usuario, produto] = await Promise.all([
    prisma.usuario.findUnique({ where: { id: usuarioId } }),
    prisma.produto.findUnique({ where: { id: item.produtoId } }),
  ]);
  if (!usuario) throw new ErroDeNegocio("Usuário não encontrado.", 404);
  if (!produto) throw new ErroDeNegocio("Produto não encontrado.", 404);

  if (produto.requerPersonalizacao && !item.personalizacao?.aceite) {
    throw new ErroDeNegocio("Falta confirmar a personalização antes de pagar.");
  }

  const pagamentoReal = pagamentoRealConfigurado();

  const pedido = await prisma.$transaction(async (tx) => {
    const criado = await tx.pedido.create({
      data: {
        usuarioId,
        // Com gateway de verdade o pedido só vira PAGO quando o webhook chega.
        status: pagamentoReal ? "AGUARDANDO_PAGAMENTO" : "PAGO",
        total: produto.preco,
        pagamentoMock: !pagamentoReal,
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

    // No modo simulado o pedido já nasce pago, então o aviso sai junto. Com
    // pagamento real quem avisa é o webhook, depois da confirmação.
    if (!pagamentoReal) {
      await notificar(
        usuarioId,
        "Pedido recebido!",
        produto.requerPersonalizacao
          ? `Recebemos seu pedido de ${produto.nome}. Sua arte entrou na fila de validação da nossa equipe.`
          : `Recebemos seu pedido de ${produto.nome}. Já entrou na fila de produção.`,
        tx
      );
    }

    return criado;
  });

  if (!pagamentoReal) {
    return { pedido, checkoutUrl: `/pedido/confirmado?id=${pedido.id}` };
  }

  // Checkout Pro: Pix, cartão e boleto ficam por conta da tela do Mercado Pago,
  // então o site não toca em dado de cartão em momento nenhum.
  try {
    const preferencia = await preferenceClient().create({
      body: {
        external_reference: pedido.id,
        items: [
          {
            id: produto.id,
            title: produto.nome,
            quantity: 1,
            unit_price: Number(produto.preco),
            currency_id: "BRL",
          },
        ],
        payer: { name: usuario.nome, email: usuario.email },
        back_urls: {
          success: `${baseUrl()}/pedido/confirmado?id=${pedido.id}`,
          pending: `${baseUrl()}/pedido/confirmado?id=${pedido.id}`,
          failure: `${baseUrl()}/checkout?erro=pagamento`,
        },
        auto_return: "approved",
        notification_url: `${baseUrl()}/api/webhooks/mercadopago`,
      },
    });

    if (!preferencia.init_point) throw new Error("preferência sem init_point");
    return { pedido, checkoutUrl: preferencia.init_point };
  } catch (e) {
    // Sem preferência criada nenhum pagamento chega pra esse pedido, e um
    // registro AGUARDANDO_PAGAMENTO eterno só sujaria a fila da loja.
    console.error("Falha ao criar preferência no Mercado Pago", e);
    await prisma.pedido.delete({ where: { id: pedido.id } });
    throw new ErroDeNegocio(
      "Não foi possível abrir o pagamento agora. Tente de novo em instantes.",
      502
    );
  }
}

export async function getPedidoDoUsuario(usuarioId: string, id: string) {
  return prisma.pedido.findFirst({
    where: { id, usuarioId },
    include: { itens: { include: { produto: true, personalizacao: true } } },
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
// confirmação do pagamento e AGUARDANDO_PAGAMENTO é volta atrás interna.
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

const STATUS_POR_PAGAMENTO: Record<string, StatusPedido> = {
  approved: "PAGO",
  authorized: "PAGO",
  rejected: "CANCELADO",
  cancelled: "CANCELADO",
  refunded: "CANCELADO",
  charged_back: "CANCELADO",
  pending: "AGUARDANDO_PAGAMENTO",
  in_process: "AGUARDANDO_PAGAMENTO",
  in_mediation: "AGUARDANDO_PAGAMENTO",
};

const AVISO_POR_PAGAMENTO: Partial<Record<StatusPedido, { titulo: string; mensagem: string }>> = {
  PAGO: {
    titulo: "Pagamento aprovado!",
    mensagem: "Recebemos seu pagamento. Seu pedido já entrou na fila de produção.",
  },
  CANCELADO: {
    titulo: "Pagamento não aprovado",
    mensagem: "Seu pagamento não foi aprovado. Você pode tentar de novo pela sacola.",
  },
};

// Chamada pelo webhook: consulta o pagamento no Mercado Pago (a fonte da
// verdade — o corpo do webhook só traz o id) e reflete no pedido.
export async function registrarRetornoDoPagamento(pagamentoId: string) {
  const pagamento = await paymentClient().get({ id: pagamentoId });

  const pedidoId = pagamento.external_reference;
  if (!pedidoId) return;

  const pedido = await prisma.pedido.findUnique({ where: { id: pedidoId } });
  if (!pedido) return;

  const status = STATUS_POR_PAGAMENTO[pagamento.status ?? ""] ?? "AGUARDANDO_PAGAMENTO";

  // O Mercado Pago reenvia o mesmo evento até receber 200, e um pedido que a
  // loja já moveu adiante não pode voltar pra PAGO por causa de uma reentrega.
  if (pedido.status === status || (pedido.status !== "AGUARDANDO_PAGAMENTO" && status === "PAGO")) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.pedido.update({
      where: { id: pedido.id },
      data: { status, pagamentoId: String(pagamento.id ?? pagamentoId) },
    });

    const aviso = AVISO_POR_PAGAMENTO[status];
    if (aviso) {
      await notificar(pedido.usuarioId, aviso.titulo, aviso.mensagem, tx);
    }
  });
}
