import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { MercadoPagoConfig, Preference, Payment } from "mercadopago";

// Sem MERCADOPAGO_ACCESS_TOKEN o checkout roda em modo simulado (aprova na
// hora), que é como o projeto rodava antes e continua sendo o suficiente pra
// desenvolvimento e demo. Com o token, é cobrança de verdade.
export function pagamentoRealConfigurado() {
  return !!process.env.MERCADOPAGO_ACCESS_TOKEN;
}

function client() {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurado");
  return new MercadoPagoConfig({ accessToken });
}

export function preferenceClient() {
  return new Preference(client());
}

export function paymentClient() {
  return new Payment(client());
}

// Usada nas back_urls e no notification_url: o Mercado Pago precisa de URL
// absoluta e acessível por ele, então em dev o webhook só funciona de verdade
// atrás de um túnel (ex: ngrok) apontado aqui.
export function baseUrl() {
  return process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
}

// Assinatura do webhook (https://www.mercadopago.com.br/developers → suas
// integrações → webhooks). Sem MERCADOPAGO_WEBHOOK_SECRET configurado a
// checagem é pulada, porque a chave só existe depois de cadastrar a URL lá.
export function assinaturaDoWebhookValida(
  cabecalhoAssinatura: string | null,
  requestId: string | null,
  dataId: string
) {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) return true;
  if (!cabecalhoAssinatura) return false;

  // Formato do header: `ts=1704908010,v1=618c85345248dd820d5fd456117c2ab2ef8...`
  const partes = Object.fromEntries(
    cabecalhoAssinatura.split(",").map((p) => {
      const [chave, ...resto] = p.split("=");
      return [chave.trim(), resto.join("=").trim()];
    })
  );
  const { ts, v1 } = partes;
  if (!ts || !v1) return false;

  // O manifesto omite o campo inteiro quando o valor não veio, e o id entra em
  // minúsculas — os dois detalhes mudam o hash.
  const manifest = [
    `id:${dataId.toLowerCase()};`,
    requestId ? `request-id:${requestId};` : "",
    `ts:${ts};`,
  ].join("");
  const esperada = createHmac("sha256", secret).update(manifest).digest("hex");

  const a = Buffer.from(v1);
  const b = Buffer.from(esperada);
  return a.length === b.length && timingSafeEqual(a, b);
}
