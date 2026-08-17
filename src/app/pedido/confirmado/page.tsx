import Link from "next/link";
import PedidoStatusLive from "@/components/PedidoStatusLive";
import { getPedidoDoUsuario } from "@/lib/data/pedidos";
import { usuarioIdDaSessao } from "@/lib/session";

const conteudoPorStatus: Record<string, { emoji: string; titulo: string; texto: string }> = {
  AGUARDANDO_PAGAMENTO: {
    emoji: "⏳",
    titulo: "Aguardando confirmação do pagamento",
    texto:
      "Recebemos seu pedido. Assim que o Mercado Pago confirmar o pagamento (Pix costuma cair na hora; boleto pode levar até 2 dias úteis), avisamos por notificação.",
  },
  PAGO: {
    emoji: "🎁",
    titulo: "Pedido confirmado!",
    texto:
      "Recebemos seu pagamento. Se o produto tem personalização, ele entra agora na fila de validação da nossa equipe antes de seguir pra produção.",
  },
  CANCELADO: {
    emoji: "⚠️",
    titulo: "Pagamento não confirmado",
    texto:
      "Não foi possível confirmar o pagamento deste pedido. Você pode montar a sacola de novo e tentar outra forma de pagamento.",
  },
};

const proximoPasso: Record<string, string> = {
  AGUARDANDO_PAGAMENTO: "confirmação do pagamento pelo Mercado Pago",
  PAGO: "conferência de arte pela loja",
  CANCELADO: "refazer o pedido, se quiser tentar de novo",
};

export default async function PedidoConfirmadoPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  const usuarioId = await usuarioIdDaSessao();
  const pedido = id && usuarioId ? await getPedidoDoUsuario(usuarioId, id) : null;

  // Sem pedido carregado (link antigo, sessão expirada) a tela continua sendo
  // a de confirmação de sempre, só sem os detalhes.
  const status = pedido?.status ?? "PAGO";
  const conteudo = conteudoPorStatus[status] ?? conteudoPorStatus.PAGO;

  return (
    <div className="mx-auto max-w-lg px-5 py-20 text-center">
      <div className="text-5xl mb-5">{conteudo.emoji}</div>
      <h1 className="font-display text-3xl mb-3">{conteudo.titulo}</h1>
      <p className="text-ink/60 mb-8">{conteudo.texto}</p>

      <div className="bg-white border border-line rounded-lg p-5 text-left text-sm mb-8 space-y-2">
        {pedido && (
          <>
            <p><span className="text-ink/50">Pedido:</span> #{pedido.id.slice(0, 8)}</p>
            <p>
              <span className="text-ink/50">Total:</span>{" "}
              R$ {Number(pedido.total).toFixed(2).replace(".", ",")}
            </p>
          </>
        )}
        <p>
          <span className="text-ink/50">Status:</span> {status.replaceAll("_", " ").toLowerCase()}
        </p>
        <p><span className="text-ink/50">Próximo passo:</span> {proximoPasso[status]}</p>
        <p><span className="text-ink/50">Se houver problema:</span> contato via WhatsApp</p>
      </div>

      {pedido && status === "AGUARDANDO_PAGAMENTO" && (
        <PedidoStatusLive pedidoId={pedido.id} status={status} />
      )}

      <Link
        href="/"
        className="inline-block bg-pine text-paper px-6 py-2.5 rounded-full text-sm"
      >
        Voltar pra loja
      </Link>
    </div>
  );
}
