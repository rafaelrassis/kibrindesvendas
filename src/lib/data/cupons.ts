import "server-only";
import { Prisma, type Cupom as CupomDb } from "@prisma/client";
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

type CupomComProduto = CupomDb & { produto?: { nome: string } | null };

export function paraCupomPublico(c: CupomComProduto): Cupom {
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
    produtoId: c.produtoId,
    produtoNome: c.produto?.nome ?? null,
    primeiraCompra: c.primeiraCompra,
    createdAt: c.createdAt.toISOString(),
  };
}

// "Já comprou antes" conta qualquer pedido que não seja CANCELADO — inclui
// de propósito o AGUARDANDO_PAGAMENTO: um checkout em aberto já é uma
// tentativa de primeira compra do cliente, e ignorá-lo deixaria reaproveitar
// um cupom de primeira compra em pedidos abertos em série (sem nunca
// cancelar nada) — uma forma fácil de burlar a trava. Cancelado não conta
// porque nunca virou venda de verdade.
export async function usuarioJaComprou(
  usuarioId: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma
): Promise<boolean> {
  const pedido = await tx.pedido.findFirst({
    where: { usuarioId, status: { not: "CANCELADO" } },
    select: { id: true },
  });
  return pedido !== null;
}

// Confere se o cupom pode ser usado nesse pedido e devolve o valor de
// desconto já calculado, mais se ele dá frete grátis — quem soma isso ao
// total (zerando o frete) é quem chama, não esta função: ela só diz o que o
// cupom vale, sem saber ainda quanto o frete custaria pro CEP escolhido.
// Usado tanto na pré-visualização do checkout quanto, de novo, na hora de
// gravar o pedido — nunca confiando no valor do cliente. É validação de
// preview: quem garante o limite de usos (e, pra cupom de primeira compra, o
// próprio "é a primeira mesmo") sob concorrência é `registrarUsoCupom` /
// a trava por usuário dentro da transação que grava o pedido (ver criarPedido).
export async function validarCupom(
  codigoBruto: unknown,
  valorPedido: number,
  contexto: { usuarioId: string; produtoId?: string | null }
) {
  const codigo = typeof codigoBruto === "string" ? normalizarCodigo(codigoBruto) : "";
  if (!codigo) throw new ErroDeNegocio("Informe o código do cupom.");

  const cupom = await prisma.cupom.findUnique({ where: { codigo } });
  if (!cupom) throw new ErroDeNegocio("Cupom inválido ou inativo.", 404);

  // Só consulta o histórico de pedidos quando o cupom de fato depende disso —
  // poupa uma query em todo cupom comum, que é a grande maioria.
  const jaComprou = cupom.primeiraCompra ? await usuarioJaComprou(contexto.usuarioId) : false;

  const indisponivel = checarDisponibilidade(
    {
      ativo: cupom.ativo,
      validoAte: cupom.validoAte,
      usoMaximo: cupom.usoMaximo,
      usos: cupom.usos,
      valorMinimoPedido: Number(cupom.valorMinimoPedido),
      produtoId: cupom.produtoId,
      primeiraCompra: cupom.primeiraCompra,
    },
    valorPedido,
    { produtoId: contexto.produtoId ?? null, jaComprou }
  );
  if (indisponivel) throw new ErroDeNegocio(indisponivel.mensagem, indisponivel.status);

  return {
    cupom,
    desconto: calcularDesconto(cupom.tipo, Number(cupom.valor), valorPedido),
    freteGratis: cupom.tipo === "FRETE_GRATIS",
  };
}

// Chamada dentro da transação que cria o pedido. O limite é reconferido aqui
// pelo próprio Postgres, na mesma instrução que incrementa: duas compras
// simultâneas não passam do `usoMaximo` porque a segunda transação trava até
// a primeira commitar e só então lê o contador já atualizado. Ler o cupom e
// gravar depois (o que `validarCupom` faz, pro preview) deixaria as duas
// enxergarem o mesmo valor antigo e as duas passarem.
//
// `ativo` e `usoMaximo` não eram os únicos jeitos do cupom parar de valer
// entre o preview (`validarCupom`) e este UPDATE — validade, pedido mínimo e
// produto vinculado também podiam mudar nesse intervalo (cupom expira no
// meio da compra, admin edita o mínimo ou troca o produto) e ficavam sem
// reconferência atômica nenhuma. `validoAte` entra sempre; `valorPedido` e
// `produtoId` são opcionais pra não quebrar quem já chama isto fora do fluxo
// de pedido (ex: teste de concorrência do limite de usos, que não tem um
// item de pedido pra comparar).
//
// Repare que "primeira compra" NÃO é reconferida aqui: ela depende do
// histórico de pedidos do usuário, não de uma coluna do próprio Cupom, então
// um UPDATE condicional na linha do cupom não dá conta sozinho. Quem garante
// isso sob concorrência é a trava por usuário em criarPedido
// (pg_advisory_xact_lock), reconferindo `usuarioJaComprou` já dentro da
// transação, antes mesmo do pedido ser criado.
export async function registrarUsoCupom(
  cupomId: string,
  tx: Prisma.TransactionClient,
  valorPedido?: number,
  produtoId?: string | null
) {
  // Prisma não compara duas colunas em `updateMany` (`usos < "usoMaximo"`),
  // então a condição vai em SQL cru mesmo. Prisma.sql com "TRUE" no lugar de
  // omitir a condição inteira mantém a instrução uma só, em vez de uma
  // combinatória de 4 variantes pra cobrir valorPedido/produtoId opcionais.
  const condicaoValorMinimo =
    valorPedido === undefined
      ? Prisma.sql`TRUE`
      : Prisma.sql`"valorMinimoPedido" <= ${valorPedido}`;
  const condicaoProduto =
    produtoId === undefined
      ? Prisma.sql`TRUE`
      : Prisma.sql`("produtoId" IS NULL OR "produtoId" = ${produtoId})`;

  const linhas = await tx.$executeRaw`
    UPDATE "Cupom"
    SET usos = usos + 1, "updatedAt" = NOW()
    WHERE id = ${cupomId}
      AND ativo = true
      AND ("usoMaximo" IS NULL OR usos < "usoMaximo")
      AND ("validoAte" IS NULL OR "validoAte" >= NOW())
      AND ${condicaoValorMinimo}
      AND ${condicaoProduto}
  `;
  if (linhas === 0) {
    throw new ErroDeNegocio(await motivoFalhaRegistro(tx, cupomId, valorPedido, produtoId), 409);
  }
}

// O UPDATE acima não diz sozinho qual condição barrou a linha — só que
// nenhuma bateu. Repetido aqui (fora da instrução atômica, só pra montar uma
// mensagem certeira) porque o cliente que perdeu a corrida merece saber o
// motivo de verdade, não sempre "atingiu o limite de usos" pra qualquer causa.
async function motivoFalhaRegistro(
  tx: Prisma.TransactionClient,
  cupomId: string,
  valorPedido?: number,
  produtoId?: string | null
): Promise<string> {
  const cupom = await tx.cupom.findUnique({ where: { id: cupomId } });
  if (!cupom || !cupom.ativo) return "Cupom inválido ou inativo.";
  if (cupom.validoAte && cupom.validoAte.getTime() < Date.now()) return "Este cupom expirou.";
  if (cupom.usoMaximo !== null && cupom.usos >= cupom.usoMaximo) {
    return "Este cupom acabou de atingir o limite de usos.";
  }
  if (valorPedido !== undefined && Number(cupom.valorMinimoPedido) > valorPedido) {
    return "Pedido mínimo não atingido para este cupom.";
  }
  if (produtoId !== undefined && cupom.produtoId && cupom.produtoId !== produtoId) {
    return "Este cupom não vale para este produto.";
  }
  return "Este cupom não está mais disponível para este pedido.";
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

const COM_PRODUTO = {
  produto: { select: { nome: true } },
} satisfies Prisma.CupomInclude;

export async function getCupons(): Promise<Cupom[]> {
  const cupons = await prisma.cupom.findMany({
    orderBy: { createdAt: "desc" },
    include: COM_PRODUTO,
  });
  return cupons.map(paraCupomPublico);
}

export async function getCupom(id: string): Promise<Cupom | undefined> {
  const cupom = await prisma.cupom.findUnique({ where: { id }, include: COM_PRODUTO });
  return cupom ? paraCupomPublico(cupom) : undefined;
}

export type DadosCupom = {
  codigo: string;
  tipo: "PERCENTUAL" | "FIXO" | "FRETE_GRATIS";
  valor: number;
  ativo?: boolean;
  validoAte?: string | null;
  usoMaximo?: number | null;
  valorMinimoPedido?: number;
  // null (ou omitido) = vale pra qualquer produto.
  produtoId?: string | null;
  primeiraCompra?: boolean;
};

function validarDados(dados: Partial<DadosCupom>) {
  // Frete grátis não usa o campo `valor` (a constraint do banco também exige
  // isso — ver migration 20260820000100): ele só zera o frete, não desconta
  // do produto.
  if (
    dados.tipo !== "FRETE_GRATIS" &&
    dados.valor !== undefined &&
    !(dados.valor > 0)
  ) {
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

// Mesmo raciocínio de `garantirCodigoLivre`: sem isso, um produtoId inválido
// estouraria P2003 (violação de FK) na cara do admin como 500, em vez de um
// erro de formulário. `undefined` (campo não enviado no PATCH) não passa por
// aqui — só quando o campo vem de verdade, mesmo que vazio/null.
async function garantirProdutoValido(produtoId: string | null | undefined) {
  if (!produtoId) return;
  const produto = await prisma.produto.findUnique({ where: { id: produtoId }, select: { id: true } });
  if (!produto) throw new ErroDeNegocio("Produto não encontrado.", 404);
}

export async function criarCupom(dados: DadosCupom): Promise<Cupom> {
  if (!dados.codigo?.trim() || !dados.tipo || dados.valor === undefined) {
    throw new ErroDeNegocio("Preencha código, tipo e valor do cupom.");
  }
  validarDados(dados);
  await garantirProdutoValido(dados.produtoId);

  const codigo = normalizarCodigo(dados.codigo);
  await garantirCodigoLivre(codigo);

  const cupom = await prisma.cupom.create({
    data: {
      codigo,
      tipo: dados.tipo,
      valor: dados.tipo === "FRETE_GRATIS" ? 0 : dados.valor,
      ativo: dados.ativo ?? true,
      validoAte: paraValidoAte(dados.validoAte),
      usoMaximo: dados.usoMaximo ?? null,
      valorMinimoPedido: dados.valorMinimoPedido ?? 0,
      produtoId: dados.produtoId || null,
      primeiraCompra: dados.primeiraCompra ?? false,
    },
    include: COM_PRODUTO,
  });
  return paraCupomPublico(cupom);
}

export async function atualizarCupom(id: string, dados: Partial<DadosCupom>): Promise<Cupom> {
  const atual = await prisma.cupom.findUnique({ where: { id } });
  if (!atual) throw new ErroDeNegocio("Cupom não encontrado.", 404);
  validarDados(dados);
  if (dados.produtoId !== undefined) await garantirProdutoValido(dados.produtoId);

  const codigo = dados.codigo ? normalizarCodigo(dados.codigo) : undefined;
  if (codigo) await garantirCodigoLivre(codigo, id);

  // Tipo final é o que vem no PATCH, ou o que já estava, se não mudou —
  // precisa dos dois pra saber se `valor` tem que ser zerado.
  const tipoFinal = dados.tipo ?? atual.tipo;

  const cupom = await prisma.cupom.update({
    where: { id },
    data: {
      codigo,
      tipo: dados.tipo,
      valor: tipoFinal === "FRETE_GRATIS" ? 0 : dados.valor,
      ativo: dados.ativo,
      validoAte: dados.validoAte !== undefined ? paraValidoAte(dados.validoAte) : undefined,
      usoMaximo: dados.usoMaximo !== undefined ? dados.usoMaximo : undefined,
      valorMinimoPedido: dados.valorMinimoPedido,
      produtoId: dados.produtoId !== undefined ? dados.produtoId || null : undefined,
      primeiraCompra: dados.primeiraCompra,
    },
    include: COM_PRODUTO,
  });
  return paraCupomPublico(cupom);
}

export async function removerCupom(id: string) {
  const atual = await prisma.cupom.findUnique({ where: { id } });
  if (!atual) throw new ErroDeNegocio("Cupom não encontrado.", 404);
  await prisma.cupom.delete({ where: { id } });
}
