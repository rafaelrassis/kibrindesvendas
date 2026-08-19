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
    autor: primeiroNomeMaisInicial(a.usuario.nome),
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
  const nota = Number(notaBruta);
  if (!Number.isInteger(nota) || nota < 1 || nota > 5) {
    throw new ErroDeNegocio("A nota precisa ser um número inteiro de 1 a 5.");
  }

  const comentario =
    typeof comentarioBruto === "string" && comentarioBruto.trim()
      ? comentarioBruto.trim().slice(0, 500)
      : null;

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
    autor: a.usuario.nome,
    produto: a.produto,
  }));
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
