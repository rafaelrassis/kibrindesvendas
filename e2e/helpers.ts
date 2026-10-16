// Helpers compartilhados entre specs E2E.

// Dígito verificador do CPF (mesmo algoritmo de src/lib/cpf.ts).
function digitoVerificador(base: string): number {
  let soma = 0;
  let peso = base.length + 1;
  for (const c of base) {
    soma += Number(c) * peso;
    peso--;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

// CPF válido por execução — "111111111" (e sequências repetidas) é rejeitado
// de propósito pela validação, por isso soma um índice crescente aos 9
// primeiros dígitos em vez de repetir um só.
export function cpfValidoAleatorio(): string {
  const base = Array.from({ length: 9 }, (_, i) => (i + Math.floor(Math.random() * 8) + 1) % 10).join(
    ""
  );
  const d1 = digitoVerificador(base);
  const d2 = digitoVerificador(base + d1);
  return `${base}${d1}${d2}`;
}

// PNG 1x1 válido (assinatura real, pra passar pela checagem de bytes do
// upload de arte em src/lib/arquivos.ts — um arquivo com extensão .png mas
// conteúdo qualquer é rejeitado).
export const PNG_1X1_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
