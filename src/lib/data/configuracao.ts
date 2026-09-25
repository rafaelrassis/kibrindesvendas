import "server-only";
import { TransportadoraFrete, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizarCep } from "@/lib/frete";
import { horarioValido } from "@/lib/fornecedor";
import { ErroDeNegocio } from "./erros";

const CEP_ORIGEM_PADRAO = "01310100";

export type TipoCampoMargemShopee = "percentual" | "valor";
export type SinalCampoMargemShopee = "soma" | "subtrai";

// Um campo do template do pedido Shopee (ex: "Comissão", "Renda estimada do
// pedido"). tipo diz se valorPadrao/valor lançado é % sobre o valor vendido
// ou R$ fixo; sinal diz se soma ou subtrai do lucro.
export type CampoMargemShopee = {
  nome: string;
  tipo: TipoCampoMargemShopee;
  sinal: SinalCampoMargemShopee;
  valorPadrao: number | null;
};

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
  // Cotação SuperFrete: arredonda peso e altura da caixa pro teto da faixa
  // de peso dos Correios (até 300g, depois de 1 em 1kg) em vez do peso
  // contínuo real — mesma quantidade dentro da faixa paga o mesmo frete.
  freteAchataFaixaPeso: boolean;
  // null = frete grátis automático desligado. Com um valor, todo pedido cujo
  // total de produtos (sem frete) bater ou passar disso tem o frete zerado
  // — independe de cupom, e soma sem conflito com um cupom FRETE_GRATIS
  // aplicado junto (o resultado final é o mesmo: frete 0).
  freteGratisAcimaDe: number | null;
  // Template dos campos do pedido Shopee usado ao lançar venda em
  // /admin/vendas-shopee. [] até configurar.
  camposMargemShopee: CampoMargemShopee[];
  // Taxa do Mercado Pago (%) usada no DRE. null = não configurada (conta 0).
  taxaGatewayPct: number | null;
  // Sincronização de estoque com fornecedor — ver lib/data/sync-fornecedor.ts.
  syncFornecedorAtivo: boolean;
  syncFornecedorDias: number[];
  syncFornecedorHorarios: string[];
  syncFornecedorEstoqueReposicao: number;
  syncFornecedorPausarEsgotado: boolean;
  syncFornecedorEmailAlerta: string | null;
  syncFornecedorUltimaExecucao: string | null;
  syncFornecedorResumo: { total: number; erros: number } | null;
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
    freteAchataFaixaPeso: config?.freteAchataFaixaPeso ?? true,
    freteGratisAcimaDe:
      config?.freteGratisAcimaDe != null ? Number(config.freteGratisAcimaDe) : null,
    camposMargemShopee: (config?.camposMargemShopee as CampoMargemShopee[] | null) ?? [],
    taxaGatewayPct: config?.taxaGatewayPct != null ? Number(config.taxaGatewayPct) : null,
    syncFornecedorAtivo: config?.syncFornecedorAtivo ?? false,
    syncFornecedorDias: config?.syncFornecedorDias ?? [0, 1, 2, 3, 4, 5, 6],
    syncFornecedorHorarios: config?.syncFornecedorHorarios ?? ["08:00"],
    syncFornecedorEstoqueReposicao: config?.syncFornecedorEstoqueReposicao ?? 50,
    syncFornecedorPausarEsgotado: config?.syncFornecedorPausarEsgotado ?? true,
    syncFornecedorEmailAlerta: config?.syncFornecedorEmailAlerta ?? null,
    syncFornecedorUltimaExecucao: config?.syncFornecedorUltimaExecucao?.toISOString() ?? null,
    syncFornecedorResumo:
      (config?.syncFornecedorResumo as { total: number; erros: number } | null) ?? null,
  };
}

function validarCamposMargemShopee(campos: CampoMargemShopee[]): CampoMargemShopee[] {
  return campos.map((campo) => {
    const nome = campo.nome?.trim();
    if (!nome) throw new ErroDeNegocio("Todo campo precisa de um nome.");
    if (campo.tipo !== "percentual" && campo.tipo !== "valor") {
      throw new ErroDeNegocio(`Tipo inválido em "${nome}".`);
    }
    if (campo.sinal !== "soma" && campo.sinal !== "subtrai") {
      throw new ErroDeNegocio(`Sinal inválido em "${nome}".`);
    }
    const valorPadrao = campo.valorPadrao;
    if (valorPadrao != null) {
      if (!Number.isFinite(valorPadrao) || valorPadrao < 0) {
        throw new ErroDeNegocio(`Valor padrão inválido em "${nome}".`);
      }
      if (campo.tipo === "percentual" && valorPadrao > 100) {
        throw new ErroDeNegocio(`"${nome}" é percentual — não pode passar de 100.`);
      }
    }
    return { nome, tipo: campo.tipo, sinal: campo.sinal, valorPadrao: valorPadrao ?? null };
  });
}

export async function atualizarConfiguracaoLoja(dados: {
  cepOrigem?: string;
  transportadoraAtiva?: TransportadoraFrete;
  // string vazia apaga o token; undefined deixa como está.
  melhorEnvioToken?: string;
  superFreteToken?: string;
  // null desliga a regra; undefined deixa como está.
  freteGratisAcimaDe?: number | null;
  freteAchataFaixaPeso?: boolean;
  // Substitui o template inteiro; undefined deixa como está.
  camposMargemShopee?: CampoMargemShopee[];
  // null apaga; undefined deixa como está.
  taxaGatewayPct?: number | null;
  syncFornecedorAtivo?: boolean;
  syncFornecedorDias?: number[];
  syncFornecedorHorarios?: string[];
  syncFornecedorEstoqueReposicao?: number;
  syncFornecedorPausarEsgotado?: boolean;
  // null/"" apaga; undefined deixa como está.
  syncFornecedorEmailAlerta?: string | null;
}): Promise<ConfiguracaoLoja> {
  const data: {
    cepOrigem?: string;
    transportadoraAtiva?: TransportadoraFrete;
    melhorEnvioToken?: string | null;
    superFreteToken?: string | null;
    freteGratisAcimaDe?: number | null;
    freteAchataFaixaPeso?: boolean;
    camposMargemShopee?: Prisma.InputJsonValue;
    taxaGatewayPct?: number | null;
    syncFornecedorAtivo?: boolean;
    syncFornecedorDias?: number[];
    syncFornecedorHorarios?: string[];
    syncFornecedorEstoqueReposicao?: number;
    syncFornecedorPausarEsgotado?: boolean;
    syncFornecedorEmailAlerta?: string | null;
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

  if (dados.freteAchataFaixaPeso !== undefined) {
    data.freteAchataFaixaPeso = dados.freteAchataFaixaPeso;
  }

  if (dados.camposMargemShopee !== undefined) {
    data.camposMargemShopee = validarCamposMargemShopee(
      dados.camposMargemShopee
    ) as unknown as Prisma.InputJsonValue;
  }

  if (dados.taxaGatewayPct !== undefined) {
    const taxa = dados.taxaGatewayPct;
    if (taxa !== null && !(Number.isFinite(taxa) && taxa >= 0 && taxa <= 100)) {
      throw new ErroDeNegocio("A taxa do gateway precisa estar entre 0 e 100.");
    }
    data.taxaGatewayPct = taxa;
  }

  if (dados.syncFornecedorAtivo !== undefined) data.syncFornecedorAtivo = dados.syncFornecedorAtivo;
  if (dados.syncFornecedorPausarEsgotado !== undefined) {
    data.syncFornecedorPausarEsgotado = dados.syncFornecedorPausarEsgotado;
  }

  if (dados.syncFornecedorDias !== undefined) {
    const dias = [...new Set(dados.syncFornecedorDias)].sort();
    if (dias.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
      throw new ErroDeNegocio("Dia da semana inválido.");
    }
    data.syncFornecedorDias = dias;
  }

  if (dados.syncFornecedorHorarios !== undefined) {
    const horarios = [...new Set(dados.syncFornecedorHorarios.map((h) => h.trim()))].sort();
    const invalido = horarios.find((h) => !horarioValido(h));
    if (invalido !== undefined) throw new ErroDeNegocio(`Horário inválido: "${invalido}" (use HH:MM).`);
    if (horarios.length > 24) throw new ErroDeNegocio("No máximo 24 horários por dia.");
    data.syncFornecedorHorarios = horarios;
  }

  if (dados.syncFornecedorEstoqueReposicao !== undefined) {
    const n = dados.syncFornecedorEstoqueReposicao;
    if (!Number.isInteger(n) || n < 1 || n > 100000) {
      throw new ErroDeNegocio("A quantidade de reposição precisa ser um número inteiro de 1 a 100000.");
    }
    data.syncFornecedorEstoqueReposicao = n;
  }

  if (dados.syncFornecedorEmailAlerta !== undefined) {
    const email = dados.syncFornecedorEmailAlerta?.trim() || null;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ErroDeNegocio("E-mail de alerta inválido.");
    }
    data.syncFornecedorEmailAlerta = email;
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
      freteAchataFaixaPeso: data.freteAchataFaixaPeso ?? true,
      camposMargemShopee: data.camposMargemShopee,
      taxaGatewayPct: data.taxaGatewayPct,
      syncFornecedorAtivo: data.syncFornecedorAtivo,
      syncFornecedorDias: data.syncFornecedorDias,
      syncFornecedorHorarios: data.syncFornecedorHorarios,
      syncFornecedorEstoqueReposicao: data.syncFornecedorEstoqueReposicao,
      syncFornecedorPausarEsgotado: data.syncFornecedorPausarEsgotado,
      syncFornecedorEmailAlerta: data.syncFornecedorEmailAlerta,
    },
    update: data,
  });

  return getConfiguracaoLoja();
}
