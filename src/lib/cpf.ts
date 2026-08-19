/** Remove tudo que não for dígito. */
export function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

/** Formata para 000.000.000-00 conforme o usuário digita. */
export function formatarCpf(valor: string): string {
  const d = apenasDigitos(valor).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

/** Valida formato (11 dígitos) e dígitos verificadores. Rejeita sequências repetidas. */
export function cpfValido(valor: string): boolean {
  const cpf = apenasDigitos(valor);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

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

  const d1 = digitoVerificador(cpf.slice(0, 9));
  const d2 = digitoVerificador(cpf.slice(0, 9) + d1);
  return cpf.slice(9) === `${d1}${d2}`;
}
