// Funções puras da sincronização com fornecedor (sem Prisma nem rede), pra
// serem testadas isoladas. O fluxo com banco e fetch fica em
// lib/data/sync-fornecedor.ts.
import { buildCombinacaoKey, gerarCombinacoes } from "./estoque-variacao";

// Uma variante do produto no fornecedor (ex: Cor=Preto + Tamanho=P).
export type VarianteFornecedor = {
  opcoes: string[];
  disponivel: boolean;
  // null = o fornecedor não controla estoque dessa variante (vende sem limite).
  estoque: number | null;
  preco: number | null;
};

// --- Leitura da página (Nuvemshop) ------------------------------------------

// Lê um array JSON começando em `inicio` (que aponta pro "["), respeitando
// strings — o JSON do LS.variants vem inline no <script>, sem terminador
// confiável além do fechamento do próprio array.
function lerArrayJson(texto: string, inicio: number): unknown {
  let nivel = 0;
  let emString = false;
  for (let i = inicio; i < texto.length; i++) {
    const c = texto[i];
    if (emString) {
      if (c === "\\") i++;
      else if (c === '"') emString = false;
      continue;
    }
    if (c === '"') emString = true;
    else if (c === "[") nivel++;
    else if (c === "]") {
      nivel--;
      if (nivel === 0) return JSON.parse(texto.slice(inicio, i + 1));
    }
  }
  throw new Error("JSON incompleto");
}

function decodificarEntidades(s: string) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function variantesBrutas(html: string): unknown {
  // Fonte principal: `LS.variants = [...]`, que só existe na página de
  // produto e é sempre do produto principal (os "relacionados" da página
  // têm data-variants próprios, mas não entram aqui).
  const marcador = html.indexOf("LS.variants");
  if (marcador >= 0) {
    const inicio = html.indexOf("[", marcador);
    if (inicio >= 0) {
      try {
        return lerArrayJson(html, inicio);
      } catch {
        // cai no plano B abaixo
      }
    }
  }
  // Plano B: data-variants do container principal (o que não é item de
  // lista/carrossel de relacionados).
  for (const m of html.matchAll(/class="([^"]*js-product-container[^"]*)"[^>]*?data-variants="([^"]+)"/g)) {
    if (m[1].includes("js-item-product")) continue;
    try {
      return JSON.parse(decodificarEntidades(m[2]));
    } catch {
      // tenta o próximo
    }
  }
  return null;
}

// Extrai as variantes do produto principal de uma página de produto
// Nuvemshop. Lança erro com mensagem legível quando a página não tem o que
// esperamos (link errado, layout mudou, produto removido).
export function extrairVariantesNuvemshop(html: string): VarianteFornecedor[] {
  const bruto = variantesBrutas(html);
  if (!Array.isArray(bruto) || bruto.length === 0) {
    throw new Error(
      "Não achei as variações do produto na página — o link pode não ser de um produto, ou o site mudou."
    );
  }
  return bruto.map((v: Record<string, unknown>) => {
    const opcoes: string[] = [];
    for (let i = 0; i < 3; i++) {
      const o = v[`option${i}`];
      if (typeof o === "string" && o.trim()) opcoes.push(o.trim());
    }
    const estoque = typeof v.stock === "number" ? v.stock : null;
    const preco = typeof v.price_number === "number" ? v.price_number : null;
    return {
      opcoes,
      // `available` já considera estoque 0; stock 0 sem o campo também conta
      // como indisponível.
      disponivel: v.available === true && estoque !== 0,
      estoque,
      preco,
    };
  });
}

// --- Casamento com o cadastro daqui -----------------------------------------

// "Azul Marinho", "azul  marinho" e "AZUL MARINHO" viram a mesma coisa, e
// acento não atrapalha ("Bordô" = "Bordo").
export function normalizarOpcao(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export type ProdutoParaSync = {
  variacoes: { tipo: string; valores: string[] }[];
  estoque: number | null;
  estoqueVariacoes: { combinacao: string; estoque: number }[];
};

export type ResultadoSync = {
  // Produto sem variação: novo valor de `estoque` (undefined = não mexe).
  estoque?: number | null;
  // Produto com variação: grade inteira nova (undefined = não mexe).
  grade?: { combinacao: string; estoque: number }[];
  zeradas: string[];
  reativadas: string[];
  // Combinações daqui sem nenhuma variante correspondente no fornecedor.
  semCorrespondencia: string[];
  esgotadoTotal: boolean;
  precoMinimo: number | null;
};

// Novo estoque de um item a partir das variantes do fornecedor que batem
// com ele. Indisponível → 0. Disponível com número → o número do
// fornecedor. Disponível sem número (sem limite lá) → mantém o que tem
// aqui, ou volta pra `reposicao` se estava zerado.
function novoEstoque(
  correspondentes: VarianteFornecedor[],
  atual: number | null,
  reposicao: number
): number | null {
  const disponiveis = correspondentes.filter((v) => v.disponivel);
  if (disponiveis.length === 0) return 0;
  if (disponiveis.every((v) => v.estoque != null)) {
    return disponiveis.reduce((s, v) => s + (v.estoque ?? 0), 0);
  }
  if (atual == null) return null;
  return atual > 0 ? atual : reposicao;
}

function rotulo(combinacao: Record<string, string>) {
  return Object.values(combinacao).join(" / ");
}

// Calcula o que muda no produto daqui a partir das variantes do fornecedor.
// Uma combinação daqui (ex: Cor=Preto, Tamanho=P) bate com toda variante do
// fornecedor que tem todos os valores dela entre as opções — assim funciona
// mesmo se aqui só existir "Cor" e lá existir "Cor + Tamanho" (fica
// disponível se algum tamanho daquela cor estiver). O nome do tipo ("Cor",
// "Tamanho") não importa, só os valores.
export function calcularSync(
  produto: ProdutoParaSync,
  variantes: VarianteFornecedor[],
  reposicao: number
): ResultadoSync {
  const precos = variantes.map((v) => v.preco).filter((p): p is number => p != null && p > 0);
  const base = {
    zeradas: [] as string[],
    reativadas: [] as string[],
    semCorrespondencia: [] as string[],
    esgotadoTotal: variantes.every((v) => !v.disponivel),
    precoMinimo: precos.length > 0 ? Math.min(...precos) : null,
  };

  const variacoes = produto.variacoes.filter((v) => v.valores.length > 0);
  if (variacoes.length === 0) {
    const atual = produto.estoque;
    const novo = novoEstoque(variantes, atual, reposicao);
    if (novo === 0 && atual !== 0) base.zeradas.push("produto");
    if (atual === 0 && novo !== 0) base.reativadas.push("produto");
    return { ...base, estoque: novo === atual ? undefined : novo };
  }

  const opcoesFornecedor = variantes.map((v) => new Set(v.opcoes.map(normalizarOpcao)));
  const atuais = new Map(produto.estoqueVariacoes.map((e) => [e.combinacao, e.estoque]));
  const controlado = produto.estoqueVariacoes.length > 0;

  let mudou = false;
  const grade = gerarCombinacoes(variacoes).map((c) => {
    const chave = buildCombinacaoKey(c);
    const valores = Object.values(c).map(normalizarOpcao);
    const correspondentes = variantes.filter((_, i) =>
      valores.every((valor) => opcoesFornecedor[i].has(valor))
    );
    const atual = atuais.get(chave);

    if (correspondentes.length === 0) {
      base.semCorrespondencia.push(rotulo(c));
      // Sem par no fornecedor não dá pra afirmar nada: mantém o que tem, ou,
      // se a grade está nascendo agora, segue vendendo como vendia (sem
      // controle = sem limite).
      const estoque = atual ?? reposicao;
      if (atual === undefined) mudou = true;
      return { combinacao: chave, estoque };
    }

    const novo = novoEstoque(correspondentes, atual ?? null, reposicao) ?? reposicao;
    if (novo === 0 && atual !== 0) base.zeradas.push(rotulo(c));
    if (atual === 0 && novo !== 0) base.reativadas.push(rotulo(c));
    if (novo !== atual) mudou = true;
    return { combinacao: chave, estoque: novo };
  });

  // Controle desligado e nada esgotado lá: não liga o controle à toa.
  if (!controlado && base.zeradas.length === 0) return base;
  // Combinação que existia na grade mas não existe mais nas variações
  // (grade desatualizada) também conta como mudança.
  if (grade.length !== produto.estoqueVariacoes.length) mudou = true;
  return mudou ? { ...base, grade } : base;
}

// --- Agenda -----------------------------------------------------------------

// Brasil não tem horário de verão desde 2019: horário de Brasília é UTC-3 o
// ano todo.
const OFFSET_BRASILIA_MS = 3 * 60 * 60 * 1000;

export function horarioValido(h: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(h);
}

// Instante do último horário agendado que já passou (até 7 dias pra trás),
// ou null se não há nenhum. `dias` usa 0 = domingo; `horarios` "HH:MM" em
// horário de Brasília. O ciclo roda se a última execução completa é mais
// antiga que isso — então um cron atrasado ou que pulou uma hora ainda pega
// o horário perdido na próxima chamada.
export function ultimoHorarioAgendado(
  agora: Date,
  dias: number[],
  horarios: string[]
): Date | null {
  const validos = horarios.filter(horarioValido).sort().reverse();
  if (validos.length === 0 || dias.length === 0) return null;
  const local = new Date(agora.getTime() - OFFSET_BRASILIA_MS);
  for (let d = 0; d <= 7; d++) {
    const dia = new Date(
      Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - d)
    );
    if (!dias.includes(dia.getUTCDay())) continue;
    for (const h of validos) {
      const [hh, mm] = h.split(":").map(Number);
      const instante = new Date(dia.getTime() + (hh * 60 + mm) * 60000 + OFFSET_BRASILIA_MS);
      if (instante <= agora) return instante;
    }
  }
  return null;
}

// Link aceito no cadastro: https, domínio de verdade (não IP nem localhost)
// — a URL é buscada pelo servidor, então não pode apontar pra rede interna.
export function validarUrlFornecedor(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || !host.includes(".") || /^[\d.]+$/.test(host) || host.includes(":")) {
    return null;
  }
  return u.toString();
}
