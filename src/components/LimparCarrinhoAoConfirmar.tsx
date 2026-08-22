"use client";

import { useEffect } from "react";
import { useCart } from "@/lib/cart-context";

// A sacola só é esvaziada quando o pagamento é confirmado — não na hora de
// criar o pedido (ver CheckoutResumo). Pagamento recusado ou ainda
// aguardando deixa o item intacto, pra "tentar de novo pela sacola" valer de
// verdade; o webhook cobre o caso de a confirmação chegar dias depois (boleto)
// com a aba já fechada, limpando a sacola gravada no banco.
export default function LimparCarrinhoAoConfirmar({ status }: { status: string }) {
  const { limpar } = useCart();

  useEffect(() => {
    if (status === "PAGO") limpar();
  }, [status, limpar]);

  return null;
}
