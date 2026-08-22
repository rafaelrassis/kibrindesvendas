import "server-only";
import { prisma } from "@/lib/prisma";
import { ErroDeNegocio } from "./erros";

export type AvaliacaoPublica = {
  id: string;
  nota: number;
  comentario: string | null;
  autor: string;
  createdAt: string;
};

export type ResumoAvaliacoes = {
  media: number;
  total: number;
};

// Nome parcial pra não expor o cliente inteiro numa review pública — mesmo
// padrão de privacidade que o resto da vitrine já segue.
function primeiroNomeMaisInicial(nomeCompleto: string) {
  const partes = nomeCompleto.trim().split(/\s+/);
  const primeiro = partes[0] ?? "Cliente";
  const inicial = partes[1]?.[0];
  return inicial ? `${primeiro} ${inicial}.` : primeiro;
}

// Só avaliações aprovadas aparecem na vitrine — a pendente de moderação some
// da tela sem virar erro, é como se ainda não existisse pro público.
export async function getAvaliacoesAprovadas(produtoId: string): Promise<AvaliacaoPublica[]> {
  const avaliacoes = await prisma.avaliacao.findMany({
    where: { produtoId, aprovado: true },
    include: { usuario: { select: { nome: true } } },
    orderBy: { createdAt: "desc" },
  });

  return avaliacoes.map((a) => ({
    id: a.id,
    nota: a.nota,
    comentario: a.comentario,
    // Sem cliente por trás (avaliação criada pelo admin), o autor é o nome
    // digitado na hora do cadastro — sem o corte de privacidade, já que não
    // veio de um cadastro de cliente de verdade.
    autor: a.usuario ? primeiroNomeMaisInicial(a.usuario.nome) : (a.autorNome ?? "Cliente"),
    createdAt: a.createdAt.toISOString(),
  }));
}

export async function getResumoAvaliacoes(produtoId: string): Promise<ResumoAvaliacoes> {
  const resultado = await prisma.avaliacao.aggregate({
    where: { produtoId, aprovado: true },
    _avg: { nota: true },
    _count: true,
  });
  return {
    media: resultado._avg.nota ? Math.round(resultado._avg.nota * 10) / 10 : 0,
    total: resultado._count,
  };
}

// Só quem tem pedido pago (ou além) desse produto pode avaliar — barra quem
// nunca comprou de encher a vitrine de review sem ter recebido o item.
// AGUARDANDO_PAGAMENTO, CANCELADO e DEVOLVIDO ficam de fora de propósito.
const STATUS_QUE_LIBERA_AVALIACAO = ["PAGO", "EM_PRODUCAO", "ENVIADO", "ENTREGUE"] as const;

async function usuarioComprouProduto(usuarioId: string, produtoId: string) {
  const item = await prisma.itemPedido.findFirst({
    where: {
      produtoId,
      pedido: { usuarioId, status: { in: [...STATUS_QUE_LIBERA_AVALIACAO] } },
    },
  });
  return !!item;
}

export async function getMinhaAvaliacao(usuarioId: string, produtoId: string) {
  return prisma.avaliacao.findUnique({
    where: { produtoId_usuarioId: { produtoId, usuarioId } },
  });
}

export async function criarOuAtualizarAvaliacao(
  usuarioId: string,
  produtoId: string,
  notaBruta: unknown,
  comentarioBruto: unknown
) {
  const { nota, comentario } = validarNotaEComentario(notaBruta, comentarioBruto);

  const produto = await prisma.produto.findUnique({ where: { id: produtoId } });
  if (!produto) throw new ErroDeNegocio("Produto não encontrado.", 404);

  const comprou = await usuarioComprouProduto(usuarioId, produtoId);
  if (!comprou) {
    throw new ErroDeNegocio("Só é possível avaliar produtos que você já comprou.", 403);
  }

  // upsert: reenviar a mesma avaliação edita em vez de duplicar (a unique
  // constraint [produtoId, usuarioId] já garante isso no banco). Editar volta
  // pro estado pendente — o admin revê antes de publicar de novo.
  return prisma.avaliacao.upsert({
    where: { produtoId_usuarioId: { produtoId, usuarioId } },
    update: { nota, comentario, aprovado: false },
    create: { produtoId, usuarioId, nota, comentario, aprovado: false },
  });
}

// --- Admin -------------------------------------------------------------

export type AvaliacaoAdmin = {
  id: string;
  nota: number;
  comentario: string | null;
  aprovado: boolean;
  createdAt: string;
  autor: string;
  criadoPorAdmin: boolean;
  produto: { id: string; nome: string };
};

export async function getAvaliacoesAdmin(): Promise<AvaliacaoAdmin[]> {
  const avaliacoes = await prisma.avaliacao.findMany({
    include: { usuario: { select: { nome: true } }, produto: { select: { id: true, nome: true } } },
    orderBy: { createdAt: "desc" },
  });
  return avaliacoes.map((a) => ({
    id: a.id,
    nota: a.nota,
    comentario: a.comentario,
    aprovado: a.aprovado,
    createdAt: a.createdAt.toISOString(),
    autor: a.usuario?.nome ?? a.autorNome ?? "Cliente",
    criadoPorAdmin: a.criadoPorAdmin,
    produto: a.produto,
  }));
}

function validarNotaEComentario(notaBruta: unknown, comentarioBruto: unknown) {
  const nota = Number(notaBruta);
  if (!Number.isInteger(nota) || nota < 1 || nota > 5) {
    throw new ErroDeNegocio("A nota precisa ser um número inteiro de 1 a 5.");
  }
  const comentario =
    typeof comentarioBruto === "string" && comentarioBruto.trim()
      ? comentarioBruto.trim().slice(0, 500)
      : null;
  return { nota, comentario };
}

// Avaliação escrita pelo admin — sem cliente real por trás (ex.: review que
// chegou por WhatsApp ou presencial e a loja quer publicar). Nasce já
// aprovada: quem está criando é a própria loja, não precisa de moderação
// de si mesma.
export async function criarAvaliacaoAdmin(
  produtoId: string,
  notaBruta: unknown,
  comentarioBruto: unknown,
  autorNomeBruto: unknown
) {
  const { nota, comentario } = validarNotaEComentario(notaBruta, comentarioBruto);
  const autorNome =
    typeof autorNomeBruto === "string" && autorNomeBruto.trim()
      ? autorNomeBruto.trim().slice(0, 80)
      : null;
  if (!autorNome) {
    throw new ErroDeNegocio("Informe o nome do autor da avaliação.");
  }

  const produto = await prisma.produto.findUnique({ where: { id: produtoId } });
  if (!produto) throw new ErroDeNegocio("Produto não encontrado.", 404);

  return prisma.avaliacao.create({
    data: { produtoId, nota, comentario, autorNome, criadoPorAdmin: true, aprovado: true },
  });
}

// Edita o conteúdo de qualquer avaliação (de cliente ou criada pelo admin).
// Campos omitidos ficam como estavam; `aprovado` continua sendo o
// PATCH separado de sempre (definirAprovacao), não muda aqui.
export async function atualizarAvaliacaoAdmin(
  id: string,
  notaBruta: unknown,
  comentarioBruto: unknown,
  autorNomeBruto: unknown
) {
  const existente = await prisma.avaliacao.findUnique({ where: { id } });
  if (!existente) throw new ErroDeNegocio("Avaliação não encontrada.", 404);

  const data: { nota?: number; comentario?: string | null; autorNome?: string | null } = {};

  if (notaBruta !== undefined) {
    const { nota, comentario } = validarNotaEComentario(
      notaBruta,
      comentarioBruto !== undefined ? comentarioBruto : existente.comentario
    );
    data.nota = nota;
    data.comentario = comentario;
  } else if (comentarioBruto !== undefined) {
    data.comentario =
      typeof comentarioBruto === "string" && comentarioBruto.trim()
        ? comentarioBruto.trim().slice(0, 500)
        : null;
  }

  // autorNome só faz sentido editar em avaliação criada pelo admin — a de
  // cliente mostra o nome do cadastro dele, não um texto livre.
  if (autorNomeBruto !== undefined && existente.criadoPorAdmin) {
    const autorNome =
      typeof autorNomeBruto === "string" && autorNomeBruto.trim()
        ? autorNomeBruto.trim().slice(0, 80)
        : null;
    if (!autorNome) throw new ErroDeNegocio("Informe o nome do autor da avaliação.");
    data.autorNome = autorNome;
  }

  return prisma.avaliacao.update({ where: { id }, data });
}

export async function definirAprovacao(id: string, aprovado: boolean) {
  try {
    return await prisma.avaliacao.update({ where: { id }, data: { aprovado } });
  } catch {
    throw new ErroDeNegocio("Avaliação não encontrada.", 404);
  }
}

export async function excluirAvaliacao(id: string) {
  await prisma.avaliacao.deleteMany({ where: { id } });
}
