// Estimativa por região, não é cotação de transportadora. Quando houver
// contrato (Correios, Melhor Envio), só esta função muda: quem chama já
// trabalha com `uf -> { valor, prazoDias }`.

export type Frete = { valor: number; prazoDias: number };

type Regiao = "SP" | "SUDESTE" | "SUL_CO" | "NORDESTE" | "NORTE";

const REGIAO_POR_UF: Record<string, Regiao> = {
  SP: "SP",
  RJ: "SUDESTE",
  MG: "SUDESTE",
  ES: "SUDESTE",
  PR: "SUL_CO",
  SC: "SUL_CO",
  RS: "SUL_CO",
  MS: "SUL_CO",
  MT: "SUL_CO",
  GO: "SUL_CO",
  DF: "SUL_CO",
  BA: "NORDESTE",
  SE: "NORDESTE",
  AL: "NORDESTE",
  PE: "NORDESTE",
  PB: "NORDESTE",
  RN: "NORDESTE",
  CE: "NORDESTE",
  PI: "NORDESTE",
  MA: "NORDESTE",
  PA: "NORTE",
  AP: "NORTE",
  AM: "NORTE",
  RR: "NORTE",
  RO: "NORTE",
  AC: "NORTE",
  TO: "NORTE",
};

const TABELA: Record<Regiao, Frete> = {
  SP: { valor: 9.9, prazoDias: 2 },
  SUDESTE: { valor: 16.9, prazoDias: 4 },
  SUL_CO: { valor: 22.9, prazoDias: 6 },
  NORDESTE: { valor: 29.9, prazoDias: 8 },
  NORTE: { valor: 36.9, prazoDias: 10 },
};

// A loja despacha de São Paulo, então UF desconhecida cai na faixa mais cara
// em vez de sair de graça.
const PADRAO: Frete = TABELA.NORTE;

export function calcularFrete(uf: string): Frete {
  return TABELA[REGIAO_POR_UF[uf.trim().toUpperCase()]] ?? PADRAO;
}

// Aceita "01310-100" ou "01310100"; devolve null quando não são 8 dígitos.
export function normalizarCep(valor: string): string | null {
  const digitos = valor.replace(/\D/g, "");
  return digitos.length === 8 ? digitos : null;
}

export function formatarCep(cep: string) {
  const digitos = cep.replace(/\D/g, "");
  return digitos.length === 8 ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : cep;
}
