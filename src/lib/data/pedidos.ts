import "server-only";
import { Prisma, StatusPedido } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ItemCarrinho } from "@/lib/cart-context";
import type { Pedido } from "@/lib/types";
import { podeSolicitarDevolucao } from "@/lib/status-pedido";
import {
  baseUrl,
  pagamentoRealConfigurado,
  paymentClient,
  preferenceClient,
} from "@/lib/mercadopago";
import { consultarEnderecoSalvo, resumoDoEndereco } from "./entrega";
import { ErroDeNegocio } from "./erros";
import { notificar } from "./notificacoes";
import { enviarEmailStatusPedido } from "@/lib/email";
import { devolverUsoCupom, normalizarCodigo, registrarUsoCupom, validarCupom } from "./cupons";
import { getConfiguracaoLoja } from "./configuracao";
import {
  decrementarEstoque,
  decrementarEstoqueVariacao,
  devolverEstoque,
  devolverEstoqueVariacao,
} from "./produtos";
import { buildCombinacaoKey, precoEfetivo } from "@/lib/estoque-variacao";
import { normalizarPrecosValores } from "./produtos";

// Dinheiro em ponto flutuante estoura a casa dos centavos (39.9 + 16.9 dá
// 56.800000000000004); a coluna é Decimal(10,2), então arredonda antes.
function emReais(valor: number) {
  return Math.round(valor * 100) / 100;
}

// Cria o pedido e devolve pra onde mandar o cliente em seguida: a página
// hospedada do Mercado Pago quando o pagamento é real, ou direto a tela de
// confirmação no modo simulado.
export async function criarPedido(
  usuarioId: string,
  item: ItemCarrinho,
  enderecoId: unknown,
  cupomCodigo?: unknown,
  servicoFrete?: unknown
) {
  if (!item?.produtoId) throw new ErroDeNegocio("Item do pedido inválido.");

  // Quantidade também não é confiada do navegador: normaliza aqui, valida
  // contra o produto mais abaixo (mínima + personalização) antes de usar em
  // qualquer cálculo.
  const quantidade = Math.max(1, Math.round(Number(item.quantidade)) || 1);

  // O frete é recalculado aqui de propósito: o valor que o navegador mostrou
  // é só pra visualização, quem define o que vai ser cobrado é o servidor.
  // O endereço também: exige um cadastro do próprio cliente (consultarEnderecoSalvo
  // recusa id de outro usuário ou inexistente) — pedido não sai só com CEP solto.
  const [usuario, produto, endereco] = await Promise.all([
    prisma.usuario.findUnique({ where: { id: usuarioId } }),
    prisma.produto.findUnique({
      where: { id: item.produtoId },
      include: { estoqueVariacoes: true, variacoes: true },
    }),
    consultarEnderecoSalvo(usuarioId, enderecoId, item.produtoId, quantidade, servicoFrete),
  ]);
  if (!usuario) throw new ErroDeNegocio("Usuário não encontrado.", 404);
  if (!produto) throw new ErroDeNegocio("Produto não encontrado.", 404);

  if (produto.requerPersonalizacao && !item.personalizacao?.aceite) {
    throw new ErroDeNegocio("Falta confirmar a personalização antes de pagar.");
  }

  // Item com personalização fica preso em 1 — não faz sentido pedir n artes
  // num único item. Sem personalização, o piso é o cadastrado no produto
  // (quantidadeMinima), nunca confiado só do navegador.
  if (item.personalizacao && quantidade !== 1) {
    throw new ErroDeNegocio("Item personalizado só pode ter quantidade 1.");
  }
  const quantidadeMinima = Math.max(1, produto.quantidadeMinima || 1);
  if (!item.personalizacao && quantidade < quantidadeMinima) {
    throw new ErroDeNegocio(`Pedido mínimo de ${quantidadeMinima} unidade(s) para este produto.`);
  }

  // Produto com variações e controle ligado (tem linha em estoqueVariacoes)
  // é controlado por combinação; senão cai no campo único de sempre.
  // Combinação sem linha cadastrada conta como esgotada — mesmo critério de
  // estoqueDaCombinacao.
  const combinacaoEscolhida = buildCombinacaoKey(item.variacoesEscolhidas ?? {});
  const controladoPorVariacao = produto.estoqueVariacoes.length > 0;
  const linhaVariacao = controladoPorVariacao
    ? produto.estoqueVariacoes.find((e) => e.combinacao === combinacaoEscolhida)
    : undefined;

  // Estoque também é conferido aqui antes de qualquer coisa: produto sem
  // controle passa direto, do jeito que sempre funcionou. A trava de
  // verdade (contra duas compras simultâneas da última unidade) é o UPDATE
  // condicional dentro da transação, mais abaixo — esta checagem aqui só
  // evita abrir preferência de pagamento pra um pedido que a transação ia
  // recusar de qualquer jeito.
  if (controladoPorVariacao) {
    const disponivel = linhaVariacao?.estoque ?? 0;
    if (disponivel < quantidade) {
      throw new ErroDeNegocio(
        disponivel === 0
          ? "Esta combinação está sem estoque no momento."
          : `Só restam ${disponivel} unidade(s) desta combinação.`
      );
    }
  } else if (produto.estoque !== null && produto.estoque < quantidade) {
    throw new ErroDeNegocio(
      produto.estoque === 0
        ? "Este produto está sem estoque no momento."
        : `Só restam ${produto.estoque} unidade(s) deste produto.`
    );
  }

  // O desconto também é recalculado no servidor, pelo mesmo motivo do frete:
  // o que o navegador mostrou é preview, quem decide é a validação aqui.
  // `valorPedido` já considera a quantidade — cupom percentual incide sobre
  // o total das unidades, não só sobre uma.
  // Preço final considerando variação selecionada (ex: "Tamanho imã": 7x7 =
  // R$1) — substitui o preço base do produto quando o valor tem entrada em
  // precosValores. Sem entrada aplicável, cai no preço normal.
  const precoUnitario = precoEfetivo(
    {
      preco: Number(produto.preco),
      variacoes: produto.variacoes.map((v) => ({
        tipo: v.tipo,
        precosValores: normalizarPrecosValores(v.precosValores),
      })),
    },
    item.variacoesEscolhidas ?? {}
  );
  const precoTotalProduto = precoUnitario * quantidade;
  const temCupom = typeof cupomCodigo === "string" && cupomCodigo.trim();
  const { cupom, desconto, freteGratis: freteGratisPorCupom } = temCupom
    ? await validarCupom(cupomCodigo, precoTotalProduto)
    : { cupom: null, desconto: 0, freteGratis: false };

  // Frete grátis automático por valor mínimo (ConfiguracaoLoja, editável em
  // /admin/cupons) soma sem conflito com o cupom: os dois só zeram o frete,
  // não empilham desconto nenhum um sobre o outro.
  const config = await getConfiguracaoLoja();
  const freteGratisPorValor =
    config.freteGratisAcimaDe !== null && precoTotalProduto >= config.freteGratisAcimaDe;
  const freteGratis = freteGratisPorCupom || freteGratisPorValor;

  const pagamentoReal = pagamentoRealConfigurado();
  // Pix exige CPF do pagador — sem ele o Mercado Pago trava o botão "Criar
  // Pix" na tela deles até preencher. Cadastro novo já obriga o campo (ver
  // /api/auth/registro); isso aqui cobre só quem se cadastrou antes dele
  // existir.
  if (pagamentoReal && !usuario.cpf) {
    throw new ErroDeNegocio(
      "Complete seu CPF em Conta > Meus dados antes de finalizar o pagamento."
    );
  }
  const frete = freteGratis ? 0 : endereco.frete.valor;
  const subtotal = emReais(precoTotalProduto - desconto);
  const total = emReais(subtotal + frete);

  const pedido = await prisma.$transaction(async (tx) => {
    const criado = await tx.pedido.create({
      data: {
        usuarioId,
        // Com gateway de verdade o pedido só vira PAGO quando o webhook chega.
        status: pagamentoReal ? "AGUARDANDO_PAGAMENTO" : "PAGO",
        total,
        frete,
        // Sem frete cobrado (grátis), não faz sentido gravar qual serviço
        // teria sido usado — fica null, igual já era antes deste campo existir.
        freteServico: freteGratis ? null : endereco.frete.servico,
        freteGratis,
        desconto,
        cupomCodigo: cupom ? normalizarCodigo(cupom.codigo) : null,
        enderecoCep: endereco.cep,
        enderecoResumo: resumoDoEndereco(endereco),
        pagamentoMock: !pagamentoReal,
        itens: {
          create: [
            {
              produtoId: produto.id,
              quantidade,
              precoUnitario,
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

    // Incrementa o uso do cupom na mesma transação que cria o pedido, pra dois
    // pedidos simultâneos não passarem os dois do limite de usos. Se o último
    // uso tiver sido levado por outra compra entre a validação e aqui, o erro
    // derruba a transação inteira: o cliente ouve "cupom esgotado" e não sobra
    // pedido gravado com um desconto que o cupom não podia mais dar.
    if (cupom) {
      await registrarUsoCupom(cupom.id, tx, precoTotalProduto);
    }

    // Mesmo raciocínio pro estoque: produto sem controle passa direto, com
    // controle o desconto é condicional no próprio UPDATE (ver
    // decrementarEstoque / decrementarEstoqueVariacao) — duas compras
    // simultâneas da última unidade não vendem a mesma peça duas vezes.
    if (controladoPorVariacao) {
      await decrementarEstoqueVariacao(produto.id, combinacaoEscolhida, quantidade, tx);
    } else if (produto.estoque !== null) {
      await decrementarEstoque(produto.id, quantidade, tx);
    }

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
    // Fora da transação de propósito: e-mail é melhor esforço, uma falha dele
    // não pode desfazer um pedido que já foi gravado com sucesso.
    enviarEmailStatusPedido(
      usuario.email,
      usuario.nome,
      "Pedido recebido!",
      produto.requerPersonalizacao
        ? `Recebemos seu pedido de ${produto.nome}. Sua arte entrou na fila de validação da nossa equipe.`
        : `Recebemos seu pedido de ${produto.nome}. Já entrou na fila de produção.`
    ).catch(() => {});
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
            // Desconto do cupom já embutido aqui: a soma dos itens da
            // preferência precisa bater com `total`, e o Mercado Pago não
            // aceita item de valor negativo pra representar desconto.
            // Vai como 1 item de valor já somado (quantidade × preço − desconto)
            // em vez de `quantity: quantidade`, porque o desconto do cupom é um
            // valor único que não dá pra ratear certinho entre unidades sem
            // gerar diferença de centavos contra `subtotal`.
            title: [
              produto.nome,
              quantidade > 1 ? `(${quantidade}x)` : null,
              cupom ? `(cupom ${cupom.codigo})` : null,
            ]
              .filter(Boolean)
              .join(" "),
            quantity: 1,
            unit_price: subtotal,
            currency_id: "BRL",
          },
          // Frete como item separado: a soma da preferência tem que bater com
          // o total do pedido, e o cliente vê o valor discriminado na tela do
          // MP. Frete grátis não entra como item de R$ 0 — some da lista,
          // porque o motivo (cupom ou valor mínimo) já aparece no título do
          // produto ou no resumo do pedido.
          ...(frete > 0
            ? [
                {
                  id: "frete",
                  title: `Frete — ${endereco.cidade}/${endereco.uf}`,
                  quantity: 1,
                  unit_price: frete,
                  currency_id: "BRL",
                },
              ]
            : []),
        ],
        payer: {
          name: usuario.nome,
          email: usuario.email,
          identification: usuario.cpf ? { type: "CPF", number: usuario.cpf } : undefined,
        },
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
    // O uso do cupom volta junto com o pedido: a vaga foi embora por falha de
    // infraestrutura, não por uma venda. Uma falha aqui na limpeza não pode
    // esconder do cliente o motivo real — o erro do pagamento é o que sobe.
    try {
      await prisma.$transaction(async (tx) => {
        await tx.pedido.delete({ where: { id: pedido.id } });
        if (pedido.cupomCodigo) {
          await devolverUsoCupom(pedido.cupomCodigo, tx);
        }
        if (controladoPorVariacao) {
          await devolverEstoqueVariacao(produto.id, combinacaoEscolhida, quantidade, tx);
        } else if (produto.estoque !== null) {
          await devolverEstoque(produto.id, quantidade, tx);
        }
      });
    } catch (erroDaLimpeza) {
      console.error("Falha ao desfazer o pedido sem preferência", erroDaLimpeza);
    }
    throw new ErroDeNegocio(
      "Não foi possível abrir o pagamento agora. Tente de novo em instantes.",
      502
    );
  }
}

const COM_ITENS = {
  itens: { include: { produto: true, personalizacao: true } },
} satisfies Prisma.PedidoInclude;

type PedidoComItens = Prisma.PedidoGetPayload<{ include: typeof COM_ITENS }>;

// Decimal e Date não sobrevivem ao JSON: a conversão acontece aqui, uma vez,
// em vez de em cada componente.
export function paraPedidoPublico(pedido: PedidoComItens): Pedido {
  return {
    id: pedido.id,
    status: pedido.status,
    total: Number(pedido.total),
    frete: Number(pedido.frete),
    freteServico: pedido.freteServico,
    freteGratis: pedido.freteGratis,
    desconto: Number(pedido.desconto),
    cupomCodigo: pedido.cupomCodigo,
    enderecoResumo: pedido.enderecoResumo,
    motivoDevolucao: pedido.motivoDevolucao,
    codigoRastreio: pedido.codigoRastreio,
    pagamentoMock: pedido.pagamentoMock,
    createdAt: pedido.createdAt.toISOString(),
    itens: pedido.itens.map((item) => ({
      id: item.id,
      quantidade: item.quantidade,
      precoUnitario: Number(item.precoUnitario),
      // `variacaoEscolhida` é Json no banco: sempre gravado como objeto simples.
      variacoes: (item.variacaoEscolhida as Record<string, string> | null) ?? {},
      produto: {
        id: item.produto.id,
        nome: item.produto.nome,
        emoji: item.produto.emoji,
        cor: item.produto.cor,
      },
      personalizacao: item.personalizacao && {
        tipo: item.personalizacao.tipo,
        briefing: item.personalizacao.briefing,
        arteUrl: item.personalizacao.arteUrl,
      },
    })),
  };
}

export async function getPedidoDoUsuario(usuarioId: string, id: string) {
  return prisma.pedido.findFirst({
    where: { id, usuarioId },
    include: COM_ITENS,
  });
}

export async function getPedidosDoUsuario(usuarioId: string) {
  const pedidos = await prisma.pedido.findMany({
    where: { usuarioId },
    orderBy: { createdAt: "desc" },
    include: COM_ITENS,
  });
  return pedidos.map(paraPedidoPublico);
}

// Devolução é pedida pelo cliente e ainda passa pela loja: o pedido só entra
// em DEVOLUCAO_SOLICITADA aqui, e quem marca DEVOLVIDO é o admin, depois de
// receber o produto de volta.
export async function solicitarDevolucao(usuarioId: string, id: string, motivoBruto: unknown) {
  const motivo = typeof motivoBruto === "string" ? motivoBruto.trim() : "";
  if (!motivo) throw new ErroDeNegocio("Descreva o motivo da devolução.");

  const pedido = await prisma.pedido.findFirst({ where: { id, usuarioId } });
  if (!pedido) throw new ErroDeNegocio("Pedido não encontrado.", 404);

  if (!podeSolicitarDevolucao(pedido.status)) {
    throw new ErroDeNegocio(
      pedido.status === "DEVOLUCAO_SOLICITADA" || pedido.status === "DEVOLVIDO"
        ? "Este pedido já está em devolução."
        : "Só dá pra pedir devolução depois que o pedido for entregue."
    );
  }

  return prisma.$transaction(async (tx) => {
    const atualizado = await tx.pedido.update({
      where: { id },
      data: { status: "DEVOLUCAO_SOLICITADA", motivoDevolucao: motivo },
      include: COM_ITENS,
    });

    await notificar(
      usuarioId,
      "Devolução solicitada",
      "Recebemos seu pedido de devolução. Nossa equipe entra em contato com as instruções de postagem.",
      tx
    );

    return paraPedidoPublico(atualizado);
  });
}

// Apaga o pedido de vez (itens e personalização vão junto, por cascade no
// schema). Não devolve estoque nem uso de cupom — mesmo critério que o
// resto do fluxo de status já segue (cancelar/marcar devolvido também não
// mexe nisso), então um pedido de teste ou duplicado não deixa a loja com
// número torto de estoque "sobrando" sem ter saído fisicamente. Ação
// irreversível: existe sobretudo pra liberar produto preso em pedido de
// teste, o que `removerProduto` bloqueia de propósito.
export async function removerPedido(id: string) {
  const pedido = await prisma.pedido.findUnique({ where: { id } });
  if (!pedido) throw new ErroDeNegocio("Pedido não encontrado.", 404);
  await prisma.pedido.delete({ where: { id } });
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
  // A solicitação feita pelo cliente já avisa por conta própria; este aviso é
  // pro caso da loja abrir a devolução pelo admin.
  DEVOLUCAO_SOLICITADA: "Sua devolução foi registrada. Em breve enviamos as instruções de postagem.",
  DEVOLVIDO: "Recebemos seu produto de volta e a devolução foi concluída.",
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

  const pedido = await prisma.pedido.findUnique({ where: { id }, include: { usuario: true } });
  if (!pedido) throw new ErroDeNegocio("Pedido não encontrado.", 404);

  // Reenviar o mesmo status (dois cliques no select) não gera aviso repetido.
  if (pedido.status === status) return pedido;

  const atualizado = await prisma.$transaction(async (tx) => {
    const atualizado = await tx.pedido.update({ where: { id }, data: { status } });

    const aviso = AVISO_POR_STATUS[status];
    if (aviso) {
      await notificar(pedido.usuarioId, "Atualização do seu pedido", aviso, tx);
    }

    return atualizado;
  });

  const aviso = AVISO_POR_STATUS[status];
  if (aviso) {
    enviarEmailStatusPedido(
      pedido.usuario.email,
      pedido.usuario.nome,
      "Atualização do seu pedido",
      aviso
    ).catch(() => {});
  }

  return atualizado;
}

// Código dos Correios (ou da transportadora que a cotação escolheu), gravado
// pelo admin depois que o pedido é despachado — normalmente junto de marcar
// ENVIADO, mas a tela deixa editar mais tarde também. Não valida um formato
// fixo: a cotação (Melhor Envio) não é só Correios, e recusar um código
// legítimo de outra transportadora custa mais do que aceitar um cadastrado
// errado, que o admin corrige na mesma tela.
export async function definirCodigoRastreio(id: string, codigoBruto: unknown) {
  const codigo = typeof codigoBruto === "string" ? codigoBruto.trim().toUpperCase() : "";
  if (codigo.length > 40) {
    throw new ErroDeNegocio("Código de rastreio muito longo.");
  }

  const pedido = await prisma.pedido.findUnique({ where: { id }, include: { usuario: true } });
  if (!pedido) throw new ErroDeNegocio("Pedido não encontrado.", 404);

  const atualizado = await prisma.$transaction(async (tx) => {
    const atualizado = await tx.pedido.update({
      where: { id },
      data: { codigoRastreio: codigo || null },
    });

    // Só avisa ao cadastrar um código novo — apagar ou reeditar o mesmo texto
    // não é novidade nenhuma pro cliente.
    if (codigo && codigo !== pedido.codigoRastreio) {
      await notificar(
        pedido.usuarioId,
        "Código de rastreio disponível",
        `Seu pedido já tem código de rastreio: ${codigo}.`,
        tx
      );
    }

    return atualizado;
  });

  if (codigo && codigo !== pedido.codigoRastreio) {
    enviarEmailStatusPedido(
      pedido.usuario.email,
      pedido.usuario.nome,
      "Código de rastreio disponível",
      `Seu pedido já tem código de rastreio: ${codigo}.`
    ).catch(() => {});
  }

  return atualizado;
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

  const pedido = await prisma.pedido.findUnique({
    where: { id: pedidoId },
    include: { usuario: true },
  });
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

    // Pagamento confirmado esvazia a sacola gravada no banco: cobre o caso
    // do cliente ter fechado a aba antes da confirmação (boleto, que pode
    // levar dias) — sem isso só a limpeza no client, feita em
    // LimparCarrinhoAoConfirmar, aconteceria, e ela depende de reabrir a
    // página do pedido.
    if (status === "PAGO") {
      await tx.carrinhoItem.deleteMany({ where: { usuarioId: pedido.usuarioId } });
    }

    const aviso = AVISO_POR_PAGAMENTO[status];
    if (aviso) {
      await notificar(pedido.usuarioId, aviso.titulo, aviso.mensagem, tx);
    }
  });

  const aviso = AVISO_POR_PAGAMENTO[status];
  if (aviso) {
    enviarEmailStatusPedido(pedido.usuario.email, pedido.usuario.nome, aviso.titulo, aviso.mensagem).catch(
      () => {}
    );
  }
}
