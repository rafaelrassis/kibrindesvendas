"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const INTERVALO_MS = 5000;
const TENTATIVAS = 24; // ~2 min, o bastante pra um Pix cair

// A confirmação do Mercado Pago chega pelo webhook, não pela volta do cliente
// ao site: quem paga com Pix costuma ver "aguardando" por alguns segundos.
// Este componente recarrega a página do servidor até o status mudar.
export default function PedidoStatusLive({
  pedidoId,
  status,
}: {
  pedidoId: string;
  status: string;
}) {
  const router = useRouter();

  useEffect(() => {
    let tentativas = 0;
    let cancelado = false;

    const timer = setInterval(async () => {
      if (++tentativas > TENTATIVAS) {
        clearInterval(timer);
        return;
      }
      try {
        const r = await fetch(`/api/pedidos/${pedidoId}`);
        if (!r.ok) return;
        const pedido = await r.json();
        if (!cancelado && pedido.status !== status) {
          clearInterval(timer);
          router.refresh();
        }
      } catch {
        // Rede oscilou — a próxima batida tenta de novo.
      }
    }, INTERVALO_MS);

    return () => {
      cancelado = true;
      clearInterval(timer);
    };
  }, [pedidoId, status, router]);

  return null;
}
