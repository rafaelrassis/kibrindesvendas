import "server-only";
import type { Faq as FaqDb } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { Faq, FaqAdmin } from "@/lib/types";
import { ErroDeNegocio } from "./erros";

type DadosFaq = {
  pergunta?: string;
  resposta?: string;
  ativo?: boolean;
};

function paraFaq(f: FaqDb): Faq {
  return { id: f.id, pergunta: f.pergunta, resposta: f.resposta };
}

function paraFaqAdmin(f: FaqDb): FaqAdmin {
  return { ...paraFaq(f), ordem: f.ordem, ativo: f.ativo };
}

// A página /suporte. FAQ inativa não sai da área interna, mas não chega na
// loja — mesmo comportamento do carrossel de banners.
export async function getFaqsAtivas(): Promise<Faq[]> {
  const faqs = await prisma.faq.findMany({
    where: { ativo: true },
    orderBy: { ordem: "asc" },
  });
  return faqs.map(paraFaq);
}

export async function getFaqs(): Promise<FaqAdmin[]> {
  const faqs = await prisma.faq.findMany({ orderBy: { ordem: "asc" } });
  return faqs.map(paraFaqAdmin);
}

export async function getFaq(id: string): Promise<FaqAdmin | null> {
  const faq = await prisma.faq.findUnique({ where: { id } });
  return faq ? paraFaqAdmin(faq) : null;
}

function limpar(dados: DadosFaq, exigirObrigatorios: boolean) {
  const data: { pergunta?: string; resposta?: string; ativo?: boolean } = {};

  if (dados.pergunta !== undefined || exigirObrigatorios) {
    const pergunta = dados.pergunta?.trim() ?? "";
    if (!pergunta) throw new ErroDeNegocio("Informe a pergunta.");
    data.pergunta = pergunta;
  }

  if (dados.resposta !== undefined || exigirObrigatorios) {
    const resposta = dados.resposta?.trim() ?? "";
    if (!resposta) throw new ErroDeNegocio("Informe a resposta.");
    data.resposta = resposta;
  }

  if (dados.ativo !== undefined) data.ativo = !!dados.ativo;

  return data;
}

export async function criarFaq(dados: DadosFaq): Promise<FaqAdmin> {
  const data = limpar(dados, true);

  // FAQ nova entra no fim da lista; a ordem se ajusta em /admin/faqs.
  const ultima = await prisma.faq.aggregate({ _max: { ordem: true } });

  const faq = await prisma.faq.create({
    data: {
      pergunta: data.pergunta!,
      resposta: data.resposta!,
      ativo: data.ativo ?? true,
      ordem: (ultima._max.ordem ?? -1) + 1,
    },
  });
  return paraFaqAdmin(faq);
}

export async function atualizarFaq(id: string, dados: DadosFaq): Promise<FaqAdmin> {
  const atual = await prisma.faq.findUnique({ where: { id } });
  if (!atual) throw new ErroDeNegocio("Pergunta não encontrada.", 404);

  const faq = await prisma.faq.update({ where: { id }, data: limpar(dados, false) });
  return paraFaqAdmin(faq);
}

// A tela manda a lista inteira na ordem nova: numerar de uma vez evita ficar
// com duas posições iguais se uma das gravações falhar no meio.
export async function reordenarFaqs(ids: string[]) {
  const existentes = await prisma.faq.findMany({ select: { id: true } });
  const conhecidos = new Set(existentes.map((f) => f.id));

  if (ids.length !== conhecidos.size || ids.some((id) => !conhecidos.has(id))) {
    throw new ErroDeNegocio("A ordem enviada não bate com as perguntas cadastradas.", 409);
  }

  await prisma.$transaction(
    ids.map((id, ordem) => prisma.faq.update({ where: { id }, data: { ordem } }))
  );
}

export async function removerFaq(id: string) {
  const atual = await prisma.faq.findUnique({ where: { id } });
  if (!atual) throw new ErroDeNegocio("Pergunta não encontrada.", 404);

  await prisma.faq.delete({ where: { id } });
}
