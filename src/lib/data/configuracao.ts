import "server-only";
import { prisma } from "@/lib/prisma";
import { normalizarCep } from "@/lib/frete";
import { ErroDeNegocio } from "./erros";

const CEP_ORIGEM_PADRAO = "01310100";

export type ConfiguracaoLoja = {
  cepOrigem: string;
  // Token nunca sai por completo pra tela — só os últimos 4 caracteres,
  // pra confirmar visualmente que está cadastrado sem expor o segredo.
  melhorEnvioTokenConfigurado: boolean;
  melhorEnvioTokenFinal: string | null;
  // null = frete grátis automático desligado. Com um valor, todo pedido cujo
  // total de produtos (sem frete) bater ou passar disso tem o frete zerado
  // — independe de cupom, e soma sem conflito com um cupom FRETE_GRATIS
  // aplicado junto (o resultado final é o mesmo: frete 0).
  freteGratisAcimaDe: number | null;
};

export async function getConfiguracaoLoja(): Promise<ConfiguracaoLoja> {
  const config = await prisma.configuracaoLoja.findUnique({ where: { id: "singleton" } });
  return {
    cepOrigem: config?.cepOrigem ?? CEP_ORIGEM_PADRAO,
    melhorEnvioTokenConfigurado: !!config?.melhorEnvioToken,
    melhorEnvioTokenFinal: config?.melhorEnvioToken
      ? config.melhorEnvioToken.slice(-4)
      : null,
    freteGratisAcimaDe:
      config?.freteGratisAcimaDe != null ? Number(config.freteGratisAcimaDe) : null,
  };
}

export async function atualizarConfiguracaoLoja(dados: {
  cepOrigem?: string;
  // string vazia apaga o token; undefined deixa como está.
  melhorEnvioToken?: string;
  // null desliga a regra; undefined deixa como está.
  freteGratisAcimaDe?: number | null;
}): Promise<ConfiguracaoLoja> {
  const data: {
    cepOrigem?: string;
    melhorEnvioToken?: string | null;
    freteGratisAcimaDe?: number | null;
  } = {};

  if (dados.cepOrigem !== undefined) {
    const cep = normalizarCep(dados.cepOrigem);
    if (!cep) throw new ErroDeNegocio("CEP de origem inválido: informe os 8 dígitos.");
    data.cepOrigem = cep;
  }

  if (dados.melhorEnvioToken !== undefined) {
    data.melhorEnvioToken = dados.melhorEnvioToken.trim() || null;
  }

  if (dados.freteGratisAcimaDe !== undefined) {
    if (dados.freteGratisAcimaDe !== null && !(dados.freteGratisAcimaDe >= 0)) {
      throw new ErroDeNegocio("O valor mínimo pro frete grátis não pode ser negativo.");
    }
    data.freteGratisAcimaDe = dados.freteGratisAcimaDe;
  }

  await prisma.configuracaoLoja.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      cepOrigem: data.cepOrigem ?? CEP_ORIGEM_PADRAO,
      melhorEnvioToken: data.melhorEnvioToken,
      freteGratisAcimaDe: data.freteGratisAcimaDe,
    },
    update: data,
  });

  return getConfiguracaoLoja();
}
