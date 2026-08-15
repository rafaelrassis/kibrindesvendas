import Link from "next/link";

export default function PedidoConfirmadoPage() {
  return (
    <div className="mx-auto max-w-lg px-5 py-20 text-center">
      <div className="text-5xl mb-5">🎁</div>
      <h1 className="font-display text-3xl mb-3">Pedido confirmado!</h1>
      <p className="text-ink/60 mb-8">
        Recebemos seu pagamento. Se o produto tem personalização, ele entra
        agora na fila de validação da nossa equipe antes de seguir pra
        produção.
      </p>
      <div className="bg-white border border-line rounded-lg p-5 text-left text-sm mb-8 space-y-2">
        <p><span className="text-ink/50">Status:</span> Pago → Em validação</p>
        <p><span className="text-ink/50">Próximo passo:</span> conferência de arte pela loja</p>
        <p><span className="text-ink/50">Se houver problema:</span> contato via WhatsApp</p>
      </div>
      <Link
        href="/"
        className="inline-block bg-pine text-paper px-6 py-2.5 rounded-full text-sm"
      >
        Voltar pra loja
      </Link>
    </div>
  );
}
