import "server-only";
import type { Prisma, Cupom as CupomDb } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { Cupom } from "@/lib/types";
import {
  calcularDesconto,
  checarDisponibilidade,
  dataDeValidadeValida,
  normalizarCodigo,
  paraValidoAte,
} from "@/lib/cupom";
import { ErroDeNegocio } from "./erros";

export { normalizarCodigo };

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

// Confere se o cupom pode ser usado nesse pedido e devolve o valor de
// desconto já calculado. Usado tanto na pré-visualização do checkout quanto,
// de novo, na hora de gravar o pedido — nunca confiando no valor do cliente.
// É validação de preview: quem garante o limite de usos sob concorrência é
// `registrarUsoCupom`, dentro da transação que grava o pedido.
export async function validarCupom(codigoBruto: unknown, valorPedido: number) {
  const codigo = typeof codigoBruto === "string" ? normalizarCodigo(codigoBruto) : "";
  if (!codigo) throw new ErroDeNegocio("Informe o código do cupom.");

  const cupom = await prisma.cupom.findUnique({ where: { codigo } });
  if (!cupom) throw new ErroDeNegocio("Cupom inválido ou inativo.", 404);

  const indisponivel = checarDisponibilidade(
    {
      ativo: cupom.ativo,
      validoAte: cupom.validoAte,
      usoMaximo: cupom.usoMaximo,
      usos: cupom.usos,
      valorMinimoPedido: Number(cupom.valorMinimoPedido),
    },
    valorPedido
  );
  if (indisponivel) throw new ErroDeNegocio(indisponivel.mensagem, indisponivel.status);

  return { cupom, desconto: calcularDesconto(cupom.tipo, Number(cupom.valor), valorPedido) };
}

// Chamada dentro da transação que cria o pedido. O limite é reconferido aqui
// pelo próprio Postgres, na mesma instrução que incrementa: duas compras
// simultâneas não passam do `usoMaximo` porque a segunda transação trava até
// a primeira commitar e só então lê o contador já atualizado. Ler o cupom e
// gravar depois (o que `validarCupom` faz, pro preview) deixaria as duas
// enxergarem o mesmo valor antigo e as duas passarem.
export async function registrarUsoCupom(cupomId: string, tx: Prisma.TransactionClient) {
  // Prisma não compara duas colunas em `updateMany` (`usos < "usoMaximo"`),
  // então a condição vai em SQL cru mesmo.
  const linhas = await tx.$executeRaw`
    UPDATE "Cupom"
    SET usos = usos + 1, "updatedAt" = NOW()
    WHERE id = ${cupomId}
      AND ativo = true
      AND ("usoMaximo" IS NULL OR usos < "usoMaximo")
  `;
  if (linhas === 0) {
    throw new ErroDeNegocio("Este cupom acabou de atingir o limite de usos.", 409);
  }
}

// Devolve a vaga quando o pedido que consumiu o cupom não vinga (falha ao
// abrir o pagamento, por exemplo): quem perdeu o uso foi a infraestrutura, não
// uma venda. O `usos > 0` evita contador negativo se a reversão rodar duas vezes.
export async function devolverUsoCupom(codigoBruto: string, tx: Prisma.TransactionClient) {
  await tx.cupom.updateMany({
    where: { codigo: normalizarCodigo(codigoBruto), usos: { gt: 0 } },
    data: { usos: { decrement: 1 } },
  });
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
  if (!dataDeValidadeValida(dados.validoAte)) {
    throw new ErroDeNegocio("Data de validade inválida.");
  }
}

// O código é `@unique` no banco: sem essa checagem o Prisma estoura P2002 e a
// rota devolve 500 pra um erro que é do formulário.
async function garantirCodigoLivre(codigo: string, exceto?: string) {
  const conflito = await prisma.cupom.findUnique({ where: { codigo } });
  if (conflito && conflito.id !== exceto) {
    throw new ErroDeNegocio("Já existe um cupom com esse código.", 409);
  }
}

export async function criarCupom(dados: DadosCupom): Promise<Cupom> {
  if (!dados.codigo?.trim() || !dados.tipo || dados.valor === undefined) {
    throw new ErroDeNegocio("Preencha código, tipo e valor do cupom.");
  }
  validarDados(dados);

  const codigo = normalizarCodigo(dados.codigo);
  await garantirCodigoLivre(codigo);

  const cupom = await prisma.cupom.create({
    data: {
      codigo,
      tipo: dados.tipo,
      valor: dados.valor,
      ativo: dados.ativo ?? true,
      validoAte: paraValidoAte(dados.validoAte),
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

  const codigo = dados.codigo ? normalizarCodigo(dados.codigo) : undefined;
  if (codigo) await garantirCodigoLivre(codigo, id);

  const cupom = await prisma.cupom.update({
    where: { id },
    data: {
      codigo,
      tipo: dados.tipo,
      valor: dados.valor,
      ativo: dados.ativo,
      validoAte: dados.validoAte !== undefined ? paraValidoAte(dados.validoAte) : undefined,
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
