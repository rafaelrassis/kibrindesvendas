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

export function linkWhatsappCliente(
  telefone: string | null | undefined,
  nome: string
): string | null {
  const numero = telefoneParaWhatsapp(telefone);
  if (!numero) return null;
  const primeiroNome = nome.trim().split(/\s+/)[0] || "";
  const mensagem = `Oi${primeiroNome ? `, ${primeiroNome}` : ""}! Aqui é da LeoKibrindes. Vi que você deixou alguns itens no carrinho — posso te ajudar a finalizar?`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}
