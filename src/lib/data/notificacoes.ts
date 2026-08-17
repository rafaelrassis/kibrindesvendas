import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ErroDeNegocio } from "./erros";

export type NotificacaoPublica = {
  id: string;
  titulo: string;
  mensagem: string;
  lida: boolean;
  createdAt: string;
};

// A tela mostra o histórico recente; o sininho conta as não lidas dentro dele.
const LIMITE = 50;

export async function getNotificacoes(usuarioId: string): Promise<NotificacaoPublica[]> {
  const notificacoes = await prisma.notificacao.findMany({
    where: { usuarioId },
    orderBy: { createdAt: "desc" },
    take: LIMITE,
  });

  return notificacoes.map((n) => ({
    id: n.id,
    titulo: n.titulo,
    mensagem: n.mensagem,
    lida: n.lida,
    createdAt: n.createdAt.toISOString(),
  }));
}

export async function marcarNotificacaoLida(usuarioId: string, id: string, lida = true) {
  // O usuarioId entra no where: sem ele, qualquer sessão marcaria a
  // notificação de outra pessoa passando o id.
  const { count } = await prisma.notificacao.updateMany({
    where: { id, usuarioId },
    data: { lida },
  });
  if (count === 0) throw new ErroDeNegocio("Notificação não encontrada.", 404);
}

// `cliente` permite gravar dentro de uma transação — o aviso do pedido só
// existe se o pedido existir.
export async function notificar(
  usuarioId: string,
  titulo: string,
  mensagem: string,
  cliente: Prisma.TransactionClient = prisma
) {
  await cliente.notificacao.create({ data: { usuarioId, titulo, mensagem } });
}
