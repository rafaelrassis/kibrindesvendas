import "server-only";
import { prisma } from "@/lib/prisma";
import { atribuirRecuperacao } from "@/lib/recuperacao-carrinho";
import { leituraAB, type LeituraAB } from "@/lib/assuntos-carrinho";
import { linkWhatsappCliente } from "@/lib/whatsapp";
import { valorDasLinhas } from "./carrinho-valor";
import { getConfiguracaoLoja } from "./configuracao";

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
  // Link wa.me com a mensagem pronta — só quando o cliente aceita WhatsApp e tem
  // telefone válido.
  whatsapp: string | null;
  // Horas desde o último clique em "Chamar" (null = nunca contatado).
  contatadoHaHoras: number | null;
};

export type PainelCarrinhos = {
  dias: number;
  ativos: { carrinhos: number; valor: number };
  esquecidos: { carrinhos: number; valor: number; lista: CarrinhoEsquecido[] };
  // Produtos que mais aparecem nos carrinhos parados (nº de carrinhos).
  produtosParados: { produtoId: string; nome: string; carrinhos: number }[];
  lembretes: {
    enviados: number;
    recuperados: number;
    taxa: number | null; // 0–100
    receita: number;
    porTipo: { tipo: 1 | 2; enviados: number; recuperados: number; receita: number }[];
    // Teste A/B do assunto: por tipo e variante.
    porVariante: {
      tipo: 1 | 2;
      variante: "A" | "B";
      enviados: number;
      recuperados: number;
      receita: number;
    }[];
    // Teste do desconto (só tipo 2), sorteado separado do assunto.
    porVarianteCupom: { variante: "A" | "B"; enviados: number; recuperados: number; receita: number }[];
    // Leitura estatística de cada teste: "já dá pra decidir?"
    leituras: { assunto24h: LeituraAB; assunto72h: LeituraAB; desconto: LeituraAB };
    cuponsEmitidos: number;
    cuponsUsados: number;
  };
  // Cliques em "Chamar": cliente que fez pedido em até 7 dias depois do contato.
  // Pode coincidir com e-mail enviado no mesmo período (crédito não é exclusivo).
  whatsapp: { contatos: number; clientes: number; recuperados: number; receita: number };
  visitantes: {
    guardados: number;
    lembretes: number;
    recuperados: number;
    ativos: number;
    // Quem deixou telefone: lista pra chamar no WhatsApp.
    comTelefone: { email: string; valor: number; whatsapp: string; contatadoHaHoras: number | null }[];
  };
};

// Números de recuperação de carrinho dos últimos `dias`. "Recuperado" = o cliente
// fez um pedido (não cancelado) até 7 dias depois do lembrete; se recebeu dois
// lembretes antes do pedido, só o mais recente leva o crédito (a receita não
// conta em dobro).
export async function getPainelCarrinhos(dias = 30, agora = new Date()): Promise<PainelCarrinhos> {
  const desde = new Date(agora.getTime() - dias * DIA);

  // --- Carrinhos de clientes parados no banco agora ---
  const { freteGratisAcimaDe, whatsappModelo } = await getConfiguracaoLoja();
  const linhas = await prisma.carrinhoItem.findMany({
    include: {
      usuario: {
        select: { id: true, nome: true, email: true, telefone: true, prefWhatsapp: true },
      },
    },
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

  const resolvidosBrutos = await prisma.resolvidoCarrinho.findMany({
    where: { resolvidoEm: { gte: new Date(agora.getTime() - 30 * DIA) } },
    orderBy: { resolvidoEm: "desc" },
  });
  // Resolvido vale até o cliente/visitante mexer no carrinho de novo.
  const resolvidoApos = (alvo: { usuarioId?: string; email?: string }, mudouEm: number) =>
    resolvidosBrutos.some(
      (r) =>
        ((alvo.usuarioId && r.usuarioId === alvo.usuarioId) ||
          (alvo.email && r.email === alvo.email)) &&
        r.resolvidoEm.getTime() > mudouEm
    );

  const maisRecentes = [...esquecidos]
    .filter((c) => !resolvidoApos({ usuarioId: c.ls[0].usuarioId }, c.ultimaMudanca))
    .sort((a, b) => b.ultimaMudanca - a.ultimaMudanca)
    .slice(0, LIMITE_LISTA);

  const contagemProdutos = new Map<string, number>();
  for (const c of esquecidos) {
    for (const id of new Set(c.ls.map((l) => l.produtoId))) {
      contagemProdutos.set(id, (contagemProdutos.get(id) ?? 0) + 1);
    }
  }
  const topIds = [...contagemProdutos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const nomesTop = topIds.length
    ? await prisma.produto.findMany({
        where: { id: { in: topIds.map(([id]) => id) } },
        select: { id: true, nome: true },
      })
    : [];
  const produtosParados = topIds.flatMap(([id, carrinhos]) => {
    const nome = nomesTop.find((p) => p.id === id)?.nome;
    return nome ? [{ produtoId: id, nome, carrinhos }] : [];
  });
  const contagemLembretes = await prisma.lembreteCarrinho.groupBy({
    by: ["usuarioId"],
    where: { usuarioId: { in: maisRecentes.map((c) => c.ls[0].usuarioId) }, enviadoEm: { gte: desde } },
    _count: { _all: true },
  });
  // Último contato por WhatsApp (cliente ou visitante) pra ninguém ser chamado em dobro.
  const contatosRecentes = await prisma.contatoCarrinho.findMany({
    where: { criadoEm: { gte: new Date(agora.getTime() - 7 * DIA) } },
    orderBy: { criadoEm: "desc" },
    select: { usuarioId: true, email: true, criadoEm: true },
  });
  const horasDesde = (d: Date) => Math.floor((agora.getTime() - d.getTime()) / HORA);
  const ultimoContatoUsuario = (id: string) => {
    const c = contatosRecentes.find((x) => x.usuarioId === id);
    return c ? horasDesde(c.criadoEm) : null;
  };
  const ultimoContatoEmail = (email: string) => {
    const c = contatosRecentes.find((x) => x.email === email);
    return c ? horasDesde(c.criadoEm) : null;
  };
  const lista: CarrinhoEsquecido[] = await Promise.all(
    maisRecentes.map(async (c) => {
      const { usuario } = c.ls[0];
      const valor = await valorDasLinhas(paraLinhaValor(c.ls));
      return {
        usuarioId: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        itens: c.ls.reduce((soma, l) => soma + l.quantidade, 0),
        valor,
        paradoHaHoras: Math.floor((agora.getTime() - c.ultimaMudanca) / HORA),
        lembretes: contagemLembretes.find((g) => g.usuarioId === usuario.id)?._count._all ?? 0,
        whatsapp: usuario.prefWhatsapp ? linkWhatsappCliente(usuario.telefone, usuario.nome, valor, freteGratisAcimaDe, whatsappModelo)
          : null,
        contatadoHaHoras: ultimoContatoUsuario(usuario.id),
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
  const porVariante = ([1, 2] as const).flatMap((tipo) =>
    (['A', 'B'] as const).map((variante) => {
      const grupo = enviados.filter((e) => e.tipo === tipo && e.variante === variante);
      const rec = grupo.filter((e) => recuperadoPor.has(e.id));
      return {
        tipo,
        variante,
        enviados: grupo.length,
        recuperados: rec.length,
        receita: rec.reduce((soma, e) => soma + (recuperadoPor.get(e.id) ?? 0), 0),
      };
    })
  );
  const porVarianteCupom = (["A", "B"] as const).map((variante) => {
    const grupo = enviados.filter((e) => e.tipo === 2 && e.varianteCupom === variante);
    const rec = grupo.filter((e) => recuperadoPor.has(e.id));
    return {
      variante,
      enviados: grupo.length,
      recuperados: rec.length,
      receita: rec.reduce((soma, e) => soma + (recuperadoPor.get(e.id) ?? 0), 0),
    };
  });
  const dupla = (tipo: 1 | 2) => {
    const [a, b] = (["A", "B"] as const).map(
      (v) => porVariante.find((x) => x.tipo === tipo && x.variante === v)!
    );
    return leituraAB(a, b);
  };
  const leituras = {
    assunto24h: dupla(1),
    assunto72h: dupla(2),
    desconto: leituraAB(porVarianteCupom[0], porVarianteCupom[1]),
  };
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
  const comTelefoneBruto = await prisma.carrinhoVisitante.findMany({
    where: { telefone: { not: null }, restauradoEm: null },
    orderBy: { updatedAt: "desc" },
    take: LIMITE_LISTA,
    select: { email: true, telefone: true, valorCarrinho: true, updatedAt: true },
  });
  const comTelefone = comTelefoneBruto
    .filter((v) => !resolvidoApos({ email: v.email }, v.updatedAt.getTime()))
    .flatMap((v) => {
    const whatsapp = linkWhatsappCliente(v.telefone, "", Number(v.valorCarrinho), freteGratisAcimaDe, whatsappModelo);
    return whatsapp
      ? [
          {
            email: v.email,
            valor: Number(v.valorCarrinho),
            whatsapp,
            contatadoHaHoras: ultimoContatoEmail(v.email),
          },
        ]
      : [];
  });

  const contatos = await prisma.contatoCarrinho.findMany({
    where: { criadoEm: { gte: desde } },
    orderBy: { criadoEm: "asc" },
  });
  const contatosClientes = contatos.flatMap((c) =>
    c.usuarioId ? [{ id: c.id, usuarioId: c.usuarioId, enviadoEm: c.criadoEm }] : []
  );
  const pedidosContatados = contatosClientes.length
    ? await prisma.pedido.findMany({
        where: {
          usuarioId: { in: [...new Set(contatosClientes.map((c) => c.usuarioId))] },
          createdAt: { gte: desde },
          status: { not: "CANCELADO" },
        },
        select: { usuarioId: true, total: true, createdAt: true },
      })
    : [];
  const recuperadoWhats = atribuirRecuperacao(
    contatosClientes,
    pedidosContatados.map((p) => ({
      usuarioId: p.usuarioId,
      total: Number(p.total),
      createdAt: p.createdAt,
    }))
  );

  return {
    dias,
    whatsapp: {
      contatos: contatos.length,
      clientes: contatosClientes.length,
      recuperados: recuperadoWhats.size,
      receita: [...recuperadoWhats.values()].reduce((s, v) => s + v, 0),
    },
    ativos: { carrinhos: carrinhos.length, valor: valorAtivos },
    esquecidos: { carrinhos: esquecidos.length, valor: valorEsquecidos, lista },
    produtosParados,
    lembretes: {
      enviados: enviados.length,
      recuperados,
      taxa: enviados.length > 0 ? (recuperados / enviados.length) * 100 : null,
      receita: porTipo.reduce((s, t) => s + t.receita, 0),
      porTipo,
      porVariante,
      porVarianteCupom,
      leituras,
      cuponsEmitidos: codigos.length,
      cuponsUsados: cupons.filter((c) => c.usos > 0).length,
    },
    visitantes: {
      guardados,
      lembretes: lembretesVisitante,
      recuperados: recuperadosVisitante,
      ativos: ativosVisitante,
      comTelefone,
    },
  };
}
