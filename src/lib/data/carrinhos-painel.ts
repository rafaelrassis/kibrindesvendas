import "server-only";
import { prisma } from "@/lib/prisma";
import { atribuirRecuperacao } from "@/lib/recuperacao-carrinho";
import { valorDasLinhas } from "./carrinho-valor";

const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;
const LIMITE_LISTA = 30;

export type CarrinhoEsquecido = {
  usuarioId: string;
  nome: string;
  email: string;
  itens: number;
  valor: number;
  paradoHaHoras: number;
  lembretes: number;
};

export type PainelCarrinhos = {
  dias: number;
  ativos: { carrinhos: number; valor: number };
  esquecidos: { carrinhos: number; valor: number; lista: CarrinhoEsquecido[] };
  lembretes: {
    enviados: number;
    recuperados: number;
    taxa: number | null; // 0–100
    receita: number;
    porTipo: { tipo: 1 | 2; enviados: number; recuperados: number; receita: number }[];
    cuponsEmitidos: number;
    cuponsUsados: number;
  };
  visitantes: { guardados: number; lembretes: number; recuperados: number; ativos: number };
};

// Números de recuperação de carrinho dos últimos `dias`. "Recuperado" = o cliente
// fez um pedido (não cancelado) até 7 dias depois do lembrete; se recebeu dois
// lembretes antes do pedido, só o mais recente leva o crédito (a receita não
// conta em dobro).
export async function getPainelCarrinhos(dias = 30, agora = new Date()): Promise<PainelCarrinhos> {
  const desde = new Date(agora.getTime() - dias * DIA);

  // --- Carrinhos de clientes parados no banco agora ---
  const linhas = await prisma.carrinhoItem.findMany({
    include: { usuario: { select: { id: true, nome: true, email: true } } },
  });
  const porUsuario = new Map<string, typeof linhas>();
  for (const l of linhas) porUsuario.set(l.usuarioId, [...(porUsuario.get(l.usuarioId) ?? []), l]);

  const paraLinhaValor = (ls: typeof linhas) =>
    ls.map((l) => ({
      produtoId: l.produtoId,
      variacoesEscolhidas: l.variacoesEscolhidas as Record<string, string>,
      quantidade: l.quantidade,
    }));

  const limiteEsquecido = new Date(agora.getTime() - 24 * HORA);
  const carrinhos = [...porUsuario.values()].map((ls) => ({
    ls,
    ultimaMudanca: Math.max(...ls.map((l) => l.updatedAt.getTime())),
  }));
  const esquecidos = carrinhos.filter((c) => c.ultimaMudanca < limiteEsquecido.getTime());

  const [valorAtivos, valorEsquecidos] = await Promise.all([
    valorDasLinhas(paraLinhaValor(carrinhos.flatMap((c) => c.ls))),
    valorDasLinhas(paraLinhaValor(esquecidos.flatMap((c) => c.ls))),
  ]);

  const maisRecentes = [...esquecidos]
    .sort((a, b) => b.ultimaMudanca - a.ultimaMudanca)
    .slice(0, LIMITE_LISTA);
  const contagemLembretes = await prisma.lembreteCarrinho.groupBy({
    by: ["usuarioId"],
    where: { usuarioId: { in: maisRecentes.map((c) => c.ls[0].usuarioId) }, enviadoEm: { gte: desde } },
    _count: { _all: true },
  });
  const lista: CarrinhoEsquecido[] = await Promise.all(
    maisRecentes.map(async (c) => {
      const { usuario } = c.ls[0];
      return {
        usuarioId: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        itens: c.ls.reduce((soma, l) => soma + l.quantidade, 0),
        valor: await valorDasLinhas(paraLinhaValor(c.ls)),
        paradoHaHoras: Math.floor((agora.getTime() - c.ultimaMudanca) / HORA),
        lembretes: contagemLembretes.find((g) => g.usuarioId === usuario.id)?._count._all ?? 0,
      };
    })
  );

  // --- Lembretes enviados e o que voltou em pedido ---
  const enviados = await prisma.lembreteCarrinho.findMany({
    where: { enviadoEm: { gte: desde } },
    orderBy: { enviadoEm: "asc" },
  });
  const pedidos = enviados.length
    ? await prisma.pedido.findMany({
        where: {
          usuarioId: { in: [...new Set(enviados.map((e) => e.usuarioId))] },
          createdAt: { gte: desde },
          status: { not: "CANCELADO" },
        },
        select: { usuarioId: true, total: true, createdAt: true },
      })
    : [];

  const recuperadoPor = atribuirRecuperacao(
    enviados,
    pedidos.map((p) => ({ usuarioId: p.usuarioId, total: Number(p.total), createdAt: p.createdAt }))
  );

  const porTipo = ([1, 2] as const).map((tipo) => {
    const doTipo = enviados.filter((e) => e.tipo === tipo);
    const rec = doTipo.filter((e) => recuperadoPor.has(e.id));
    return {
      tipo,
      enviados: doTipo.length,
      recuperados: rec.length,
      receita: rec.reduce((soma, e) => soma + (recuperadoPor.get(e.id) ?? 0), 0),
    };
  });
  const recuperados = porTipo.reduce((s, t) => s + t.recuperados, 0);

  const codigos = enviados.flatMap((e) => (e.cupomCodigo ? [e.cupomCodigo] : []));
  const cupons = codigos.length
    ? await prisma.cupom.findMany({ where: { codigo: { in: codigos } }, select: { usos: true } })
    : [];

  // --- Visitantes que deixaram o e-mail ---
  const [guardados, lembretesVisitante, recuperadosVisitante, ativosVisitante] = await Promise.all([
    prisma.carrinhoVisitante.count({ where: { createdAt: { gte: desde } } }),
    prisma.carrinhoVisitante.count({ where: { lembreteEm: { gte: desde } } }),
    prisma.carrinhoVisitante.count({ where: { restauradoEm: { gte: desde } } }),
    prisma.carrinhoVisitante.count(),
  ]);

  return {
    dias,
    ativos: { carrinhos: carrinhos.length, valor: valorAtivos },
    esquecidos: { carrinhos: esquecidos.length, valor: valorEsquecidos, lista },
    lembretes: {
      enviados: enviados.length,
      recuperados,
      taxa: enviados.length > 0 ? (recuperados / enviados.length) * 100 : null,
      receita: porTipo.reduce((s, t) => s + t.receita, 0),
      porTipo,
      cuponsEmitidos: codigos.length,
      cuponsUsados: cupons.filter((c) => c.usos > 0).length,
    },
    visitantes: {
      guardados,
      lembretes: lembretesVisitante,
      recuperados: recuperadosVisitante,
      ativos: ativosVisitante,
    },
  };
}
