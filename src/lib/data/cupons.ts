import "server-only";
import type { Prisma, Cupom as CupomDb } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { Cupom } from "@/lib/types";
import { ErroDeNegocio } from "./erros";

export function paraCupomPublico(c: CupomDb): Cupom {
  return {
    id: c.id,
    codigo: c.codigo,
    tipo: c.tipo,
    valor: Number(c.valor),
    ativo: c.ativo,
    validoAte: c.validoAte ? c.validoAte.toISOString() : null,
    usoMaximo: c.usoMaximo,
    usos: c.usos,
    valorMinimoPedido: Number(c.valorMinimoPedido),
    createdAt: c.createdAt.toISOString(),
  };
}

// Normaliza pra maiúsculas sem espaço nas pontas — assim "promo10" e
// "PROMO10" são o mesmo cupom, tanto pra cadastrar quanto pra aplicar.
export function normalizarCodigo(codigo: string) {
  return codigo.trim().toUpperCase();
}

function calcularDesconto(cupom: CupomDb, valorPedido: number) {
  const valor = Number(cupom.valor);
  const desconto = cupom.tipo === "PERCENTUAL" ? (valorPedido * valor) / 100 : valor;
  // Nunca desconta mais do que o próprio pedido vale.
  return Math.min(Math.round(desconto * 100) / 100, valorPedido);
}

// Confere se o cupom pode ser usado nesse pedido e devolve o valor de
// desconto já calculado. Usado tanto na pré-visualização do checkout quanto,
// de novo, na hora de gravar o pedido — nunca confiando no valor do cliente.
export async function validarCupom(codigoBruto: unknown, valorPedido: number) {
  const codigo = typeof codigoBruto === "string" ? normalizarCodigo(codigoBruto) : "";
  if (!codigo) throw new ErroDeNegocio("Informe o código do cupom.");

  const cupom = await prisma.cupom.findUnique({ where: { codigo } });
  if (!cupom || !cupom.ativo) throw new ErroDeNegocio("Cupom inválido ou inativo.", 404);

  if (cupom.validoAte && cupom.validoAte.getTime() < Date.now()) {
    throw new ErroDeNegocio("Este cupom expirou.");
  }
  if (cupom.usoMaximo !== null && cupom.usos >= cupom.usoMaximo) {
    throw new ErroDeNegocio("Este cupom já atingiu o limite de usos.");
  }
  if (valorPedido < Number(cupom.valorMinimoPedido)) {
    throw new ErroDeNegocio(
      `Pedido mínimo de R$ ${Number(cupom.valorMinimoPedido).toFixed(2).replace(".", ",")} para este cupom.`
    );
  }

  return { cupom, desconto: calcularDesconto(cupom, valorPedido) };
}

// Chamada dentro da transação que cria o pedido — incrementa o contador de
// uso na mesma escrita que grava o pedido, pra não deixar o cupom passar do
// limite em duas compras simultâneas.
export async function registrarUsoCupom(cupomId: string, tx: Prisma.TransactionClient) {
  await tx.cupom.update({ where: { id: cupomId }, data: { usos: { increment: 1 } } });
}

// --- Admin (CRUD) -----------------------------------------------------------

export async function getCupons(): Promise<Cupom[]> {
  const cupons = await prisma.cupom.findMany({ orderBy: { createdAt: "desc" } });
  return cupons.map(paraCupomPublico);
}

export async function getCupom(id: string): Promise<Cupom | undefined> {
  const cupom = await prisma.cupom.findUnique({ where: { id } });
  return cupom ? paraCupomPublico(cupom) : undefined;
}

export type DadosCupom = {
  codigo: string;
  tipo: "PERCENTUAL" | "FIXO";
  valor: number;
  ativo?: boolean;
  validoAte?: string | null;
  usoMaximo?: number | null;
  valorMinimoPedido?: number;
};

function validarDados(dados: Partial<DadosCupom>) {
  if (dados.valor !== undefined && !(dados.valor > 0)) {
    throw new ErroDeNegocio("Informe um valor de desconto maior que zero.");
  }
  if (dados.tipo === "PERCENTUAL" && dados.valor !== undefined && dados.valor > 100) {
    throw new ErroDeNegocio("Cupom percentual não pode passar de 100%.");
  }
  if (dados.usoMaximo != null && dados.usoMaximo <= 0) {
    throw new ErroDeNegocio("O limite de usos precisa ser maior que zero.");
  }
  if (dados.valorMinimoPedido != null && dados.valorMinimoPedido < 0) {
    throw new ErroDeNegocio("O pedido mínimo não pode ser negativo.");
  }
}

export async function criarCupom(dados: DadosCupom): Promise<Cupom> {
  if (!dados.codigo?.trim() || !dados.tipo || dados.valor === undefined) {
    throw new ErroDeNegocio("Preencha código, tipo e valor do cupom.");
  }
  validarDados(dados);

  const codigo = normalizarCodigo(dados.codigo);
  const existente = await prisma.cupom.findUnique({ where: { codigo } });
  if (existente) throw new ErroDeNegocio("Já existe um cupom com esse código.", 409);

  const cupom = await prisma.cupom.create({
    data: {
      codigo,
      tipo: dados.tipo,
      valor: dados.valor,
      ativo: dados.ativo ?? true,
      validoAte: dados.validoAte ? new Date(dados.validoAte) : null,
      usoMaximo: dados.usoMaximo ?? null,
      valorMinimoPedido: dados.valorMinimoPedido ?? 0,
    },
  });
  return paraCupomPublico(cupom);
}

export async function atualizarCupom(id: string, dados: Partial<DadosCupom>): Promise<Cupom> {
  const atual = await prisma.cupom.findUnique({ where: { id } });
  if (!atual) throw new ErroDeNegocio("Cupom não encontrado.", 404);
  validarDados(dados);

  const cupom = await prisma.cupom.update({
    where: { id },
    data: {
      codigo: dados.codigo ? normalizarCodigo(dados.codigo) : undefined,
      tipo: dados.tipo,
      valor: dados.valor,
      ativo: dados.ativo,
      validoAte:
        dados.validoAte !== undefined
          ? dados.validoAte
            ? new Date(dados.validoAte)
            : null
          : undefined,
      usoMaximo: dados.usoMaximo !== undefined ? dados.usoMaximo : undefined,
      valorMinimoPedido: dados.valorMinimoPedido,
    },
  });
  return paraCupomPublico(cupom);
}

export async function removerCupom(id: string) {
  const atual = await prisma.cupom.findUnique({ where: { id } });
  if (!atual) throw new ErroDeNegocio("Cupom não encontrado.", 404);
  await prisma.cupom.delete({ where: { id } });
}
