// Regras do cupom que não dependem do banco: cálculo do desconto, leitura da
// data de validade e a lista de motivos que impedem o uso. Ficam aqui, fora de
// `src/lib/data`, porque não importam `server-only` nem Prisma — assim dá pra
// testar cada regra sozinha (ver cupom.test.ts), do jeito que já é feito com
// o frete (`src/lib/frete.ts` × `src/lib/data/entrega.ts`).

import { formatarPreco } from "./compare-price";

export type TipoCupom = "PERCENTUAL" | "FIXO" | "FRETE_GRATIS";

// Normaliza pra maiúsculas sem espaço nas pontas — assim "promo10" e
// "PROMO10" são o mesmo cupom, tanto pra cadastrar quanto pra aplicar.
export function normalizarCodigo(codigo: string) {
  return codigo.trim().toUpperCase();
}

// Frete grátis não desconta do valor dos produtos — zera o frete, que é
// somado depois, fora daqui (ver total no checkout e em criarPedido). Cupom
// desse tipo sempre tem `valor: 0` (não usa o campo), então calcularDesconto
// devolve 0 de propósito: nenhum desconto no subtotal do pedido.
export function calcularDesconto(tipo: TipoCupom, valor: number, valorPedido: number) {
  if (tipo === "FRETE_GRATIS") return 0;
  const desconto = tipo === "PERCENTUAL" ? (valorPedido * valor) / 100 : valor;
  // Nunca desconta mais do que o próprio pedido vale.
  return Math.min(Math.round(desconto * 100) / 100, valorPedido);
}

// A loja atende só o Brasil, então "válido até 25/08" significa até o fim do
// dia 25 no horário de Brasília. Sem o fuso explícito, `new Date("2026-08-25")`
// vira meia-noite UTC — 21h do dia 24 aqui — e o cupom morre quase um dia antes.
export function fimDoDiaBrasilia(dataISO: string): Date {
  return new Date(`${dataISO}T23:59:59.999-03:00`);
}

const SO_DATA = /^\d{4}-\d{2}-\d{2}$/;

// O formulário do admin manda a data crua do `<input type="date">`
// ("2026-08-25"), que ganha o fim do dia de Brasília. Um valor que já vem com
// horário (cupom antigo, script, importação) passa intacto: quem mandou já
// escolheu o instante.
export function paraValidoAte(entrada: string | null | undefined): Date | null {
  const texto = typeof entrada === "string" ? entrada.trim() : "";
  if (!texto) return null;

  const data = SO_DATA.test(texto) ? fimDoDiaBrasilia(texto) : new Date(texto);
  if (Number.isNaN(data.getTime())) return null;
  return data;
}

export function dataDeValidadeValida(entrada: string | null | undefined) {
  const texto = typeof entrada === "string" ? entrada.trim() : "";
  return !texto || paraValidoAte(texto) !== null;
}

// O que o serviço precisa saber do cupom pra decidir se ele vale — de
// propósito só campos simples, pra o teste montar o caso sem tocar no Prisma.
export type EstadoCupom = {
  ativo: boolean;
  validoAte: Date | null;
  usoMaximo: number | null;
  usos: number;
  valorMinimoPedido: number;
};

export type Indisponibilidade = { mensagem: string; status: number };

// Primeiro motivo que impede o uso, ou `null` quando o cupom vale pra esse
// pedido. `valorPedido` é sempre preço × quantidade atual: cupom percentual
// incide sobre o total das unidades, e o pedido mínimo é comparado contra ele.
export function checarDisponibilidade(
  cupom: EstadoCupom,
  valorPedido: number,
  agora = Date.now()
): Indisponibilidade | null {
  if (!cupom.ativo) {
    return { mensagem: "Cupom inválido ou inativo.", status: 404 };
  }
  if (cupom.validoAte && cupom.validoAte.getTime() < agora) {
    return { mensagem: "Este cupom expirou.", status: 400 };
  }
  if (cupom.usoMaximo !== null && cupom.usos >= cupom.usoMaximo) {
    return { mensagem: "Este cupom já atingiu o limite de usos.", status: 400 };
  }
  if (valorPedido < cupom.valorMinimoPedido) {
    return {
      mensagem: `Pedido mínimo de ${formatarPreco(cupom.valorMinimoPedido)} para este cupom.`,
      status: 400,
    };
  }
  return null;
}
