import "server-only";
import { prisma } from "@/lib/prisma";
import { ErroDeNegocio } from "./erros";

export async function criarNotificacao(
  usuarioId: string,
  titulo: string,
  mensagem: string
) {
  return prisma.notificacao.create({ data: { usuarioId, titulo, mensagem } });
}

export async function getNotificacoes(usuarioId: string, limite = 50) {
  return prisma.notificacao.findMany({
    where: { usuarioId },
    orderBy: { createdAt: "desc" },
    take: limite,
  });
}

// updateMany com o usuarioId no where serve de dono: notificação de outra
// pessoa não é encontrada e vira 404, sem vazar que ela existe.
export async function marcarNotificacao(
  usuarioId: string,
  id: string,
  lida: boolean
) {
  const { count } = await prisma.notificacao.updateMany({
    where: { id, usuarioId },
    data: { lida },
  });
  if (count === 0) throw new ErroDeNegocio("Notificação não encontrada.", 404);
}
