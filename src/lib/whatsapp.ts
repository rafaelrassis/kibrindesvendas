// Link wa.me para a loja chamar o cliente (carrinho parado). Sem API: a pessoa
// da loja abre o link e envia a mensagem — nada é enviado sozinho.

// Telefone brasileiro (DDD + 8/9 dígitos, com ou sem 55) -> só dígitos com DDI.
// null quando não parece um número válido.
export function telefoneParaWhatsapp(telefone: string | null | undefined): string | null {
  const digitos = (telefone ?? "").replace(/\D/g, "");
  if (digitos.length === 10 || digitos.length === 11) return `55${digitos}`;
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith("55")) return digitos;
  return null;
}

const reais = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// {nome} = primeiro nome; {frete} = frase de frete grátis (ou vazio).
export const MODELO_WHATSAPP_PADRAO =
  "Oi, {nome}! Aqui é da LeoKibrindes. Vi que você deixou alguns itens no carrinho. {frete}Posso te ajudar a finalizar?";

function fraseFrete(valor?: number, limite?: number | null): string {
  if (valor == null || limite == null || limite <= 0) return "";
  if (valor >= limite) return "Seu pedido já tem frete grátis! ";
  const falta = limite - valor;
  if (falta <= limite * 0.3) return `Faltam só ${reais(falta)} pra você ganhar frete grátis. `;
  return "";
}

// Mensagem pronta a partir do modelo da loja (ou do padrão).
export function mensagemCarrinhoWhatsapp(
  nome: string,
  valor?: number,
  freteGratisAcimaDe?: number | null,
  modelo?: string | null
): string {
  const primeiroNome = nome.trim().split(/\s+/)[0] || "";
  return (modelo?.trim() || MODELO_WHATSAPP_PADRAO)
    .replaceAll("{nome}", primeiroNome)
    .replaceAll("{frete}", fraseFrete(valor, freteGratisAcimaDe))
    .replace(/,\s*!/g, "!")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function linkWhatsappCliente(
  telefone: string | null | undefined,
  nome: string,
  valor?: number,
  freteGratisAcimaDe?: number | null,
  modelo?: string | null
): string | null {
  const numero = telefoneParaWhatsapp(telefone);
  if (!numero) return null;
  const mensagem = mensagemCarrinhoWhatsapp(nome, valor, freteGratisAcimaDe, modelo);
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}
