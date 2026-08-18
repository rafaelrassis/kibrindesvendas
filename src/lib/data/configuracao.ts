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
};

export async function getConfiguracaoLoja(): Promise<ConfiguracaoLoja> {
  const config = await prisma.configuracaoLoja.findUnique({ where: { id: "singleton" } });
  return {
    cepOrigem: config?.cepOrigem ?? CEP_ORIGEM_PADRAO,
    melhorEnvioTokenConfigurado: !!config?.melhorEnvioToken,
    melhorEnvioTokenFinal: config?.melhorEnvioToken
      ? config.melhorEnvioToken.slice(-4)
      : null,
  };
}

export async function atualizarConfiguracaoLoja(dados: {
  cepOrigem?: string;
  // string vazia apaga o token; undefined deixa como está.
  melhorEnvioToken?: string;
}): Promise<ConfiguracaoLoja> {
  const data: { cepOrigem?: string; melhorEnvioToken?: string | null } = {};

  if (dados.cepOrigem !== undefined) {
    const cep = normalizarCep(dados.cepOrigem);
    if (!cep) throw new ErroDeNegocio("CEP de origem inválido: informe os 8 dígitos.");
    data.cepOrigem = cep;
  }

  if (dados.melhorEnvioToken !== undefined) {
    data.melhorEnvioToken = dados.melhorEnvioToken.trim() || null;
  }

  await prisma.configuracaoLoja.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", cepOrigem: data.cepOrigem ?? CEP_ORIGEM_PADRAO, melhorEnvioToken: data.melhorEnvioToken },
    update: data,
  });

  return getConfiguracaoLoja();
}
