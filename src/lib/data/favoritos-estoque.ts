import "server-only";
import { prisma } from "@/lib/prisma";
import { baseUrl } from "@/lib/mercadopago";
import { produtoEsgotado } from "@/lib/estoque-variacao";
import { enviarEmailVoltouAoEstoque } from "@/lib/email";
import { notificar } from "./notificacoes";

// Teto de avisos por produto: um produto muito favoritado não pode virar uma
// rajada de e-mails de uma vez só.
const LIMITE_AVISOS = 200;

type EstadoEstoque = {
  ativo: boolean;
  estoque: number | null;
  estoqueVariacoes: { combinacao: string; estoque: number }[];
};

// "Indisponível" pra quem favoritou: pausado na loja ou sem nada em estoque.
export function estaIndisponivel(p: EstadoEstoque): boolean {
  return !p.ativo || produtoEsgotado(p);
}

// Chamado depois de qualquer mudança de estoque/ativo (edição no admin,
// sincronização com o fornecedor). Só dispara na virada indisponível ->
// disponível, então cada reposição avisa uma vez. Nunca derruba quem chamou:
// aviso é melhor esforço.
export async function avisarSeVoltouAoEstoque(produtoId: string, estavaIndisponivel: boolean) {
  if (!estavaIndisponivel) return;
  try {
    const produto = await prisma.produto.findUnique({
      where: { id: produtoId },
      include: { estoqueVariacoes: true },
    });
    if (!produto || estaIndisponivel(produto)) return;

    const favoritos = await prisma.favorito.findMany({
      where: { produtoId },
      include: { usuario: { select: { id: true, nome: true, email: true, prefEmail: true } } },
      take: LIMITE_AVISOS,
    });

    for (const { usuario } of favoritos) {
      await notificar(
        usuario.id,
        "Voltou ao estoque!",
        `${produto.nome}, dos seus favoritos, voltou a ficar disponível.`
      );
      if (usuario.prefEmail) {
        await enviarEmailVoltouAoEstoque(
          usuario.email,
          usuario.nome,
          produto.nome,
          `${baseUrl()}/produto/${produto.id}`
        );
      }
    }
  } catch (e) {
    console.error("Falha ao avisar favoritos sobre volta ao estoque", e);
  }
}
