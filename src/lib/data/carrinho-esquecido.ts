import "server-only";
import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { baseUrl } from "@/lib/mercadopago";
import { enviarEmailCarrinhoEsquecido, enviarEmailCarrinhoVisitante } from "@/lib/email";
import { assuntoDoLembrete, varianteDoAssunto } from "@/lib/assuntos-carrinho";
import { getConfiguracaoLoja } from "./configuracao";
import { valorDasLinhas } from "./carrinho-valor";

const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;
// Lembrete 1: carrinho parado há 24h, e só até 7 dias — mais velho que isso já
// esfriou, e lembrar de algo de semanas atrás só incomoda.
const PARADO_HA_HORAS = 24;
const ATE_DIAS = 7;
// Lembrete 2 (com cupom): 72h parado, pelo menos 24h depois do primeiro, e só
// até 10 dias.
const PARADO_2_HA_HORAS = 72;
const INTERVALO_ENTRE_LEMBRETES_HORAS = 24;
const ATE_DIAS_2 = 10;
// Carrinho de visitante some depois de 30 dias parado.
const VISITANTE_VALE_DIAS = 30;
// Teto por execução e por etapa: o cron é diário, e uma rajada de e-mails de
// uma vez só queima a reputação do remetente.
const LIMITE_POR_ETAPA = 100;

// Sem 0/O/1/I: o cupom é digitado à mão a partir do e-mail.
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function codigoAleatorio() {
  let c = "VOLTA";
  for (let i = 0; i < 6; i++) c += ALFABETO[randomInt(ALFABETO.length)];
  return c;
}

async function criarCupomDeCarrinho(
  usuarioId: string,
  percentual: number,
  validadeDias: number,
  agora: Date
) {
  const validoAte = new Date(agora.getTime() + validadeDias * DIA);
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const codigo = codigoAleatorio();
    try {
      await prisma.cupom.create({
        data: {
          codigo,
          tipo: "PERCENTUAL",
          valor: percentual,
          usoMaximo: 1,
          validoAte,
          // Pessoal: o código não funciona em outra conta, mesmo repassado.
          usuarioId,
        },
      });
      return { codigo, validoAte };
    } catch (e) {
      // Colisão do código (índice único): sorteia outro. Qualquer outro erro sobe.
      if (!(e instanceof Error) || !e.message.includes("Unique constraint")) throw e;
    }
  }
  throw new Error("Não foi possível gerar um código de cupom único.");
}

type Etapa = {
  enviados: number;
};

// Lembrete 1 (simples) e 2 (com cupom, se ligado em Configurações) para
// clientes com conta. Respeita prefEmail; não manda para quem abriu pedido na
// janela (está pagando ou pagou). Os marcadores em Usuario evitam repetir, e
// salvarCarrinho zera eles quando o cliente mexe no carrinho — um carrinho
// novo pode avisar de novo. Cada envio fica em LembreteCarrinho (painel).
async function lembretesDeClientes(agora: Date, comCupom: boolean, cupomCfg: {
  percentual: number;
  // Desconto da variante B (null = mesma % nas duas) e variante travada pelo admin.
  percentualB: number | null;
  vencedor: "A" | "B" | null;
  validadeDias: number;
}) {
  const resultado = { lembrete1: { enviados: 0 } as Etapa, lembrete2: { enviados: 0 } as Etapa };

  // --- Lembrete 1 ---
  const parado = new Date(agora.getTime() - PARADO_HA_HORAS * HORA);
  const antigo = new Date(agora.getTime() - ATE_DIAS * DIA);
  const candidatos1 = await prisma.usuario.findMany({
    where: {
      prefEmail: true,
      carrinhoLembreteEm: null,
      carrinho: { some: { updatedAt: { gt: antigo } }, none: { updatedAt: { gt: parado } } },
      pedidos: { none: { createdAt: { gt: antigo } } },
    },
    include: { carrinho: { orderBy: { ordem: "asc" } } },
    take: LIMITE_POR_ETAPA,
  });

  for (const usuario of candidatos1) {
    const itens = await itensDoEmail(usuario.carrinho);
    // Marca mesmo sem itens válidos: sem isso o mesmo usuário voltaria toda
    // execução ocupando uma vaga do limite.
    await prisma.usuario.update({ where: { id: usuario.id }, data: { carrinhoLembreteEm: agora } });
    if (itens.length === 0) continue;

    const variante = cupomCfg.vencedor ?? varianteDoAssunto(usuario.id);
    await enviarEmailCarrinhoEsquecido(
      usuario.email,
      usuario.nome,
      itens,
      `${baseUrl()}/carrinho`,
      assuntoDoLembrete(1, variante)
    );
    await prisma.lembreteCarrinho.create({
      data: {
        usuarioId: usuario.id,
        tipo: 1,
        variante,
        enviadoEm: agora,
        valorCarrinho: await valorDasLinhas(
          usuario.carrinho.map((l) => ({
            produtoId: l.produtoId,
            variacoesEscolhidas: l.variacoesEscolhidas as Record<string, string>,
            quantidade: l.quantidade,
          }))
        ),
      },
    });
    resultado.lembrete1.enviados += 1;
  }

  if (!comCupom) return resultado;

  // --- Lembrete 2 (com cupom) ---
  const parado2 = new Date(agora.getTime() - PARADO_2_HA_HORAS * HORA);
  const antigo2 = new Date(agora.getTime() - ATE_DIAS_2 * DIA);
  const depoisDoPrimeiro = new Date(agora.getTime() - INTERVALO_ENTRE_LEMBRETES_HORAS * HORA);
  const candidatos2 = await prisma.usuario.findMany({
    where: {
      prefEmail: true,
      carrinhoLembreteEm: { not: null, lt: depoisDoPrimeiro },
      carrinhoLembrete2Em: null,
      carrinho: { some: { updatedAt: { gt: antigo2 } }, none: { updatedAt: { gt: parado2 } } },
      pedidos: { none: { createdAt: { gt: antigo2 } } },
    },
    include: { carrinho: { orderBy: { ordem: "asc" } } },
    take: LIMITE_POR_ETAPA,
  });

  for (const usuario of candidatos2) {
    const itens = await itensDoEmail(usuario.carrinho);
    await prisma.usuario.update({ where: { id: usuario.id }, data: { carrinhoLembrete2Em: agora } });
    if (itens.length === 0) continue;

    const variante = cupomCfg.vencedor ?? varianteDoAssunto(usuario.id);
    const percentual =
      variante === "B" && cupomCfg.percentualB ? cupomCfg.percentualB : cupomCfg.percentual;
    const cupom = await criarCupomDeCarrinho(usuario.id, percentual, cupomCfg.validadeDias, agora);
    await enviarEmailCarrinhoEsquecido(
      usuario.email,
      usuario.nome,
      itens,
      `${baseUrl()}/carrinho`,
      assuntoDoLembrete(2, variante, percentual),
      { codigo: cupom.codigo, percentual, validoAte: cupom.validoAte }
    );
    await prisma.lembreteCarrinho.create({
      data: {
        usuarioId: usuario.id,
        tipo: 2,
        variante,
        enviadoEm: agora,
        cupomCodigo: cupom.codigo,
        valorCarrinho: await valorDasLinhas(
          usuario.carrinho.map((l) => ({
            produtoId: l.produtoId,
            variacoesEscolhidas: l.variacoesEscolhidas as Record<string, string>,
            quantidade: l.quantidade,
          }))
        ),
      },
    });
    resultado.lembrete2.enviados += 1;
  }

  return resultado;
}

async function itensDoEmail(linhas: { produtoId: string; quantidade: number }[]) {
  const produtos = await prisma.produto.findMany({
    where: { id: { in: linhas.map((l) => l.produtoId) }, ativo: true },
    select: { id: true, nome: true },
  });
  return linhas.flatMap((l) => {
    const produto = produtos.find((p) => p.id === l.produtoId);
    return produto ? [{ nome: produto.nome, quantidade: l.quantidade }] : [];
  });
}

// Visitante que deixou o e-mail no carrinho: 1 lembrete após 24h parado (até 7
// dias), e o registro some depois de 30 dias.
async function lembretesDeVisitantes(agora: Date) {
  const parado = new Date(agora.getTime() - PARADO_HA_HORAS * HORA);
  const antigo = new Date(agora.getTime() - ATE_DIAS * DIA);

  const visitantes = await prisma.carrinhoVisitante.findMany({
    where: { lembreteEm: null, updatedAt: { lt: parado, gt: antigo } },
    take: LIMITE_POR_ETAPA,
  });

  let enviados = 0;
  for (const v of visitantes) {
    const linhas = (Array.isArray(v.itens) ? v.itens : []) as {
      produtoId: string;
      quantidade: number;
    }[];
    const itens = await itensDoEmail(linhas);
    await prisma.carrinhoVisitante.update({ where: { id: v.id }, data: { lembreteEm: agora } });
    if (itens.length === 0) continue;

    await enviarEmailCarrinhoVisitante(
      v.email,
      itens,
      `${baseUrl()}/carrinho/recuperar/${v.token}`,
      `${baseUrl()}/carrinho/recuperar/${v.token}?cancelar=1`
    );
    enviados += 1;
  }

  const limpos = await prisma.carrinhoVisitante.deleteMany({
    where: { updatedAt: { lt: new Date(agora.getTime() - VISITANTE_VALE_DIAS * DIA) } },
  });

  return { enviados, removidos: limpos.count };
}

export async function enviarLembretesCarrinho(agora = new Date()) {
  const config = await getConfiguracaoLoja();
  if (!config.lembreteCarrinhoAtivo) return { ativo: false as const };

  const clientes = await lembretesDeClientes(agora, config.cupomCarrinhoAtivo, {
    percentual: config.cupomCarrinhoPercentual,
    percentualB: config.cupomCarrinhoPercentualB,
    vencedor: config.assuntoVencedor,
    validadeDias: config.cupomCarrinhoValidadeDias,
  });
  const visitantes = await lembretesDeVisitantes(agora);

  return { ativo: true as const, ...clientes, visitantes };
}
