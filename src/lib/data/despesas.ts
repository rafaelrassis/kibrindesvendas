import "server-only";
import { prisma } from "@/lib/prisma";
import { CATEGORIAS_DESPESA, type CategoriaDespesa } from "@/lib/dre";
import { ErroDeNegocio } from "./erros";

export type Despesa = {
  id: string;
  data: string; // YYYY-MM-DD
  descricao: string;
  categoria: string;
  valor: number;
};

export async function listarDespesas(inicio: Date, fim: Date): Promise<Despesa[]> {
  const linhas = await prisma.despesaOperacional.findMany({
    where: { data: { gte: inicio, lt: fim } },
    orderBy: [{ data: "desc" }, { createdAt: "desc" }],
  });
  return linhas.map((d) => ({
    id: d.id,
    data: d.data.toISOString().slice(0, 10),
    descricao: d.descricao,
    categoria: d.categoria,
    valor: Number(d.valor),
  }));
}

export async function criarDespesa(dados: {
  data?: unknown;
  descricao?: unknown;
  categoria?: unknown;
  valor?: unknown;
}) {
  const descricao = typeof dados.descricao === "string" ? dados.descricao.trim() : "";
  if (!descricao) throw new ErroDeNegocio("Informe uma descrição.");
  if (descricao.length > 120) throw new ErroDeNegocio("Descrição muito longa.");

  if (!CATEGORIAS_DESPESA.includes(dados.categoria as CategoriaDespesa)) {
    throw new ErroDeNegocio("Categoria inválida.");
  }

  const valor = typeof dados.valor === "number" ? dados.valor : Number(dados.valor);
  if (!Number.isFinite(valor) || valor <= 0 || valor > 1_000_000) {
    throw new ErroDeNegocio("Informe um valor maior que zero.");
  }

  if (typeof dados.data !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dados.data)) {
    throw new ErroDeNegocio("Data inválida.");
  }
  // Meio-dia em Brasília: o dia continua o mesmo em qualquer fuso de leitura.
  const data = new Date(`${dados.data}T12:00:00-03:00`);
  if (Number.isNaN(data.getTime())) throw new ErroDeNegocio("Data inválida.");

  return prisma.despesaOperacional.create({
    data: {
      data,
      descricao,
      categoria: dados.categoria as string,
      valor: Math.round(valor * 100) / 100,
    },
  });
}

export async function removerDespesa(id: string) {
  const existe = await prisma.despesaOperacional.findUnique({ where: { id } });
  if (!existe) throw new ErroDeNegocio("Despesa não encontrada.", 404);
  await prisma.despesaOperacional.delete({ where: { id } });
}
