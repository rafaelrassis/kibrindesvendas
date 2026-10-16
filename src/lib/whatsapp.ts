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

// Mensagem pronta. Com o valor do carrinho e o limite de frete grátis da loja,
// aproveita o argumento certo: "já tem frete grátis" ou "falta X pra ganhar".
export function mensagemCarrinhoWhatsapp(
  nome: string,
  valor?: number,
  freteGratisAcimaDe?: number | null
): string {
  const primeiroNome = nome.trim().split(/\s+/)[0] || "";
  const abertura = `Oi${primeiroNome ? `, ${primeiroNome}` : ""}! Aqui é da LeoKibrindes. Vi que você deixou alguns itens no carrinho`;
  if (valor != null && freteGratisAcimaDe != null && freteGratisAcimaDe > 0) {
    if (valor >= freteGratisAcimaDe) {
      return `${abertura} — e o seu pedido já tem frete grátis! Posso te ajudar a finalizar?`;
    }
    const falta = freteGratisAcimaDe - valor;
    if (falta <= freteGratisAcimaDe * 0.3) {
      return `${abertura} — faltam só ${reais(falta)} pra você ganhar frete grátis. Posso te ajudar a escolher mais algum item?`;
    }
  }
  return `${abertura} — posso te ajudar a finalizar?`;
}

export function linkWhatsappCliente(
  telefone: string | null | undefined,
  nome: string,
  valor?: number,
  freteGratisAcimaDe?: number | null
): string | null {
  const numero = telefoneParaWhatsapp(telefone);
  if (!numero) return null;
  const mensagem = mensagemCarrinhoWhatsapp(nome, valor, freteGratisAcimaDe);
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}
