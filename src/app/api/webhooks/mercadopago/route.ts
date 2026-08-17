import { NextRequest, NextResponse } from "next/server";
import { registrarRetornoDoPagamento } from "@/lib/data/pedidos";
import { assinaturaDoWebhookValida } from "@/lib/mercadopago";

// Retorno do Mercado Pago. Rota pública por definição — quem garante que o
// evento é real é a assinatura no header, e a consulta do pagamento na API
// deles logo em seguida.
export async function POST(req: NextRequest) {
  // O mesmo evento chega em formatos diferentes conforme a origem (webhook
  // novo no corpo, IPN legado na query) — aceita os dois.
  const corpo = await req.json().catch(() => ({}));
  const { searchParams } = new URL(req.url);
  const tipo = corpo?.type ?? searchParams.get("type") ?? searchParams.get("topic");
  const pagamentoId =
    corpo?.data?.id ?? searchParams.get("data.id") ?? searchParams.get("id");

  // Qualquer outro evento (merchant_order, plano, assinatura) não interessa
  // aqui, mas responde 200 pra não virar fila de reentrega.
  if (tipo !== "payment" || !pagamentoId) {
    return NextResponse.json({ ok: true });
  }

  const assinaturaOk = assinaturaDoWebhookValida(
    req.headers.get("x-signature"),
    req.headers.get("x-request-id"),
    String(pagamentoId)
  );
  if (!assinaturaOk) {
    return NextResponse.json({ error: "Assinatura inválida." }, { status: 401 });
  }

  try {
    await registrarRetornoDoPagamento(String(pagamentoId));
  } catch (e) {
    // 500 faz o Mercado Pago reenviar, que é o certo pra falha momentânea de
    // rede ou de banco.
    console.error("Falha ao processar webhook do Mercado Pago", e);
    return NextResponse.json({ error: "Falha ao processar evento." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
