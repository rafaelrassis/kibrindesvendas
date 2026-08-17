import CheckoutResumo from "@/components/CheckoutResumo";
import { pagamentoRealConfigurado } from "@/lib/mercadopago";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;

  // Volta do Mercado Pago pela back_url de falha: o pedido ficou registrado
  // como aguardando pagamento e o cliente pode montar a sacola de novo.
  const erroInicial =
    erro === "pagamento" ? "Pagamento não concluído. Você pode tentar de novo." : "";

  return (
    <CheckoutResumo
      pagamentoReal={pagamentoRealConfigurado()}
      erroInicial={erroInicial}
    />
  );
}
