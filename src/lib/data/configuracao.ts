import "server-only";
import { TransportadoraFrete } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizarCep } from "@/lib/frete";
import { ErroDeNegocio } from "./erros";

const CEP_ORIGEM_PADRAO = "01310100";

export type ConfiguracaoLoja = {
  cepOrigem: string;
  // Qual transportadora é consultada de fato no checkout. Só uma fica ativa
  // por vez — trocar não apaga o token da outra, só para de usá-lo.
  transportadoraAtiva: TransportadoraFrete;
  // Token nunca sai por completo pra tela — só os últimos 4 caracteres,
  // pra confirmar visualmente que está cadastrado sem expor o segredo.
  melhorEnvioTokenConfigurado: boolean;
  melhorEnvioTokenFinal: string | null;
  superFreteTokenConfigurado: boolean;
  superFreteTokenFinal: string | null;
  // null = frete grátis automático desligado. Com um valor, todo pedido cujo
  // total de produtos (sem frete) bater ou passar disso tem o frete zerado
  // — independe de cupom, e soma sem conflito com um cupom FRETE_GRATIS
  // aplicado junto (o resultado final é o mesmo: frete 0).
  freteGratisAcimaDe: number | null;
  // Defaults globais de margem pra venda manual na Shopee (/admin/vendas-shopee).
  // Um produto pode sobrescrever cada campo individualmente — ver
  // margensShopeeDoProduto em vendas-shopee.ts. null = 0% até configurar.
  shopeeComissaoPct: number | null;
  shopeeFretePct: number | null;
  shopeeAdsPct: number | null;
};

export async function getConfiguracaoLoja(): Promise<ConfiguracaoLoja> {
  const config = await prisma.configuracaoLoja.findUnique({ where: { id: "singleton" } });
  return {
    cepOrigem: config?.cepOrigem ?? CEP_ORIGEM_PADRAO,
    transportadoraAtiva: config?.transportadoraAtiva ?? TransportadoraFrete.MELHOR_ENVIO,
    melhorEnvioTokenConfigurado: !!config?.melhorEnvioToken,
    melhorEnvioTokenFinal: config?.melhorEnvioToken
      ? config.melhorEnvioToken.slice(-4)
      : null,
    superFreteTokenConfigurado: !!config?.superFreteToken,
    superFreteTokenFinal: config?.superFreteToken ? config.superFreteToken.slice(-4) : null,
    freteGratisAcimaDe:
      config?.freteGratisAcimaDe != null ? Number(config.freteGratisAcimaDe) : null,
    shopeeComissaoPct:
      config?.shopeeComissaoPct != null ? Number(config.shopeeComissaoPct) : null,
    shopeeFretePct: config?.shopeeFretePct != null ? Number(config.shopeeFretePct) : null,
    shopeeAdsPct: config?.shopeeAdsPct != null ? Number(config.shopeeAdsPct) : null,
  };
}

export async function atualizarConfiguracaoLoja(dados: {
  cepOrigem?: string;
  transportadoraAtiva?: TransportadoraFrete;
  // string vazia apaga o token; undefined deixa como está.
  melhorEnvioToken?: string;
  superFreteToken?: string;
  // null desliga a regra; undefined deixa como está.
  freteGratisAcimaDe?: number | null;
  // null desliga o default (volta a valer 0%); undefined deixa como está.
  shopeeComissaoPct?: number | null;
  shopeeFretePct?: number | null;
  shopeeAdsPct?: number | null;
}): Promise<ConfiguracaoLoja> {
  const data: {
    cepOrigem?: string;
    transportadoraAtiva?: TransportadoraFrete;
    melhorEnvioToken?: string | null;
    superFreteToken?: string | null;
    freteGratisAcimaDe?: number | null;
    shopeeComissaoPct?: number | null;
    shopeeFretePct?: number | null;
    shopeeAdsPct?: number | null;
  } = {};

  if (dados.cepOrigem !== undefined) {
    const cep = normalizarCep(dados.cepOrigem);
    if (!cep) throw new ErroDeNegocio("CEP de origem inválido: informe os 8 dígitos.");
    data.cepOrigem = cep;
  }

  if (dados.transportadoraAtiva !== undefined) {
    if (!Object.values(TransportadoraFrete).includes(dados.transportadoraAtiva)) {
      throw new ErroDeNegocio("Transportadora inválida.");
    }
    data.transportadoraAtiva = dados.transportadoraAtiva;
  }

  if (dados.melhorEnvioToken !== undefined) {
    data.melhorEnvioToken = dados.melhorEnvioToken.trim() || null;
  }

  if (dados.superFreteToken !== undefined) {
    data.superFreteToken = dados.superFreteToken.trim() || null;
  }

  if (dados.freteGratisAcimaDe !== undefined) {
    if (dados.freteGratisAcimaDe !== null && !(dados.freteGratisAcimaDe >= 0)) {
      throw new ErroDeNegocio("O valor mínimo pro frete grátis não pode ser negativo.");
    }
    data.freteGratisAcimaDe = dados.freteGratisAcimaDe;
  }

  for (const campo of ["shopeeComissaoPct", "shopeeFretePct", "shopeeAdsPct"] as const) {
    const valor = dados[campo];
    if (valor === undefined) continue;
    if (valor !== null && (valor < 0 || valor > 100)) {
      throw new ErroDeNegocio(`${campo} precisa estar entre 0 e 100.`);
    }
    data[campo] = valor;
  }

  await prisma.configuracaoLoja.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      cepOrigem: data.cepOrigem ?? CEP_ORIGEM_PADRAO,
      transportadoraAtiva: data.transportadoraAtiva ?? TransportadoraFrete.MELHOR_ENVIO,
      melhorEnvioToken: data.melhorEnvioToken,
      superFreteToken: data.superFreteToken,
      freteGratisAcimaDe: data.freteGratisAcimaDe,
      shopeeComissaoPct: data.shopeeComissaoPct,
      shopeeFretePct: data.shopeeFretePct,
      shopeeAdsPct: data.shopeeAdsPct,
    },
    update: data,
  });

  return getConfiguracaoLoja();
}
