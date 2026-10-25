// Funções puras da sincronização com fornecedor (sem Prisma nem rede), pra
// serem testadas isoladas. O fluxo com banco e fetch fica em
// lib/data/sync-fornecedor.ts.
//
// A Sete Malhas (nosso único fornecedor) saiu do Nuvemshop e hoje roda numa
// plataforma própria (vitrine SPA + API Supabase). Por isso a leitura não é
// mais scraping de HTML: é uma chamada de API que devolve a loja inteira
// (empresa + produtos) de uma vez.
import { buildCombinacaoKey, gerarCombinacoes } from "./estoque-variacao";

// Uma variante do produto no fornecedor (ex: Cor=Preto + Tamanho=P).
export type VarianteFornecedor = {
  opcoes: string[];
  disponivel: boolean;
  // null = o fornecedor não controla estoque dessa variante (vende sem limite).
  estoque: number | null;
  preco: number | null;
  // Foto da variante no fornecedor (https, já normalizada); null = sem foto.
  imagem?: string | null;
};

// --- Leitura da loja no fornecedor (API da Sete Malhas) ---------------------

export const FORNECEDOR_API_URL = "https://wvvbvkmddehdyoozbnkx.supabase.co";
// Chave "publishable" do Supabase da loja — é a mesma que o site deles expõe
// no navegador (client-side), não dá acesso a nada que já não seja público.
export const FORNECEDOR_API_KEY = "sb_publishable_EdfogpAu1VSFEhweTtWGfQ_yrDbhCx7";

export type ProdutoLojaFornecedor = {
  id: string;
  nome: string;
  referencia: string;
  descricao: string | null;
  preco: number;
  // Caminho dentro do bucket público da loja (não a URL inteira).
  foto: string | null;
  cores: string[];
  tamanhos: string[];
  fotos_cores: Record<string, string> | null;
  // cor -> tamanho -> quantidade.
  estoque: Record<string, Record<string, number>> | null;
  // cor -> tamanhos que vendem sem controle de estoque lá.
  estoque_infinito: Record<string, string[]> | null;
  // Preço específico de uma combinação, quando difere do preço base.
  precos_var: Record<string, Record<string, number>> | null;
};

export type LojaFornecedor = {
  empresa: { nome: string };
  produtos: ProdutoLojaFornecedor[];
};

// Foto do bucket da loja: só aceita caminho relativo (nunca uma URL de fora
// embutida no JSON) e monta sempre em cima do storage público de verdade.
export function urlFotoFornecedor(caminho: unknown): string | null {
  if (typeof caminho !== "string" || !caminho.trim()) return null;
  const c = caminho.trim();
  if (/^[a-z][a-z0-9+.-]*:/i.test(c) || c.startsWith("//")) return null;
  return `${FORNECEDOR_API_URL}/storage/v1/object/public/loja/${c}`;
}

// Produto do fornecedor -> uma variante por combinação Cor x Tamanho, com o
// preço e estoque específicos dela quando informados. "Infinito" lá é o
// mesmo que estoque null no resto do fluxo: vende sem limite.
export function extrairVariantesLoja(produto: ProdutoLojaFornecedor): VarianteFornecedor[] {
  if (produto.cores.length === 0 || produto.tamanhos.length === 0) {
    return [{ opcoes: [], disponivel: true, estoque: null, preco: produto.preco, imagem: null }];
  }
  const variantes: VarianteFornecedor[] = [];
  for (const cor of produto.cores) {
    for (const tamanho of produto.tamanhos) {
      const infinito = produto.estoque_infinito?.[cor]?.includes(tamanho) ?? false;
      const bruto = produto.estoque?.[cor]?.[tamanho] ?? 0;
      variantes.push({
        opcoes: [cor, tamanho],
        disponivel: infinito || bruto > 0,
        estoque: infinito ? null : bruto,
        preco: produto.precos_var?.[cor]?.[tamanho] ?? produto.preco,
        imagem: urlFotoFornecedor(produto.fotos_cores?.[cor] ?? null),
      });
    }
  }
  return variantes;
}

// Foto principal do produto no fornecedor, ou null.
export function extrairImagemPrincipalLoja(produto: ProdutoLojaFornecedor): string | null {
  return urlFotoFornecedor(produto.foto);
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

export type VariacaoLocal = { tipo: string; valores: string[] };

export type EspelhoVariacoes = {
  // Variações já com os valores do fornecedor. `indice` = posição em
  // `locais` (null = variação nova, criada a partir do fornecedor).
  // `coluna` = qual option do fornecedor (0, 1...) alimenta esta variação.
  variacoes: { indice: number | null; coluna: number; tipo: string; valores: string[] }[];
  adicionados: string[];
  removidos: { indice: number; valor: string }[];
  mudou: boolean;
};

const TIPOS_NOVOS = ["Cor", "Tamanho"];

// Deixa as variações daqui iguais às do fornecedor: valor que só existe lá
// é criado, valor que não existe mais lá é removido. O fornecedor não diz o
// nome do tipo ("Cor"/"Tamanho"), então cada coluna de opção (option0,
// option1...) é casada com a variação daqui que mais repete valores dela; se
// nenhuma casa e a loja não tem variações, a coluna vira "Cor", "Tamanho" ou
// "Opção N". Variação daqui sem coluna correspondente não é tocada. Valor
// que já existe mantém a grafia daqui (a foto/preço dele ficam ligados a ela).
export function espelharVariacoes(
  locais: VariacaoLocal[],
  variantes: VarianteFornecedor[]
): EspelhoVariacoes {
  const nColunas = Math.max(0, ...variantes.map((v) => v.opcoes.length));
  const resultado: EspelhoVariacoes = { variacoes: [], adicionados: [], removidos: [], mudou: false };
  // Variante sem opção (produto de variação única) não diz nada sobre grade.
  if (nColunas === 0 || variantes.some((v) => v.opcoes.length !== nColunas)) return resultado;

  const usadas = new Set<number>();
  for (let col = 0; col < nColunas; col++) {
    const valoresLa: string[] = [];
    const vistos = new Set<string>();
    for (const v of variantes) {
      const n = normalizarOpcao(v.opcoes[col]);
      if (!vistos.has(n)) {
        vistos.add(n);
        valoresLa.push(v.opcoes[col]);
      }
    }

    let melhor = -1;
    let acertos = 0;
    locais.forEach((l, i) => {
      if (usadas.has(i)) return;
      const n = l.valores.filter((x) => vistos.has(normalizarOpcao(x))).length;
      if (n > acertos) {
        acertos = n;
        melhor = i;
      }
    });
    // Sem nenhum valor em comum: usa a variação da mesma posição, se existir
    // e ainda estiver livre (ex: cadastro com valores todos diferentes).
    if (melhor < 0 && col < locais.length && !usadas.has(col) && locais.length === nColunas) melhor = col;

    if (melhor < 0) {
      const tipo = TIPOS_NOVOS[col] ?? `Opção ${col + 1}`;
      resultado.variacoes.push({ indice: null, coluna: col, tipo, valores: valoresLa });
      resultado.adicionados.push(...valoresLa);
      resultado.mudou = true;
      continue;
    }

    usadas.add(melhor);
    const local = locais[melhor];
    const grafiaLocal = new Map(local.valores.map((x) => [normalizarOpcao(x), x]));
    const valores = valoresLa.map((x) => grafiaLocal.get(normalizarOpcao(x)) ?? x);
    for (const x of valoresLa) if (!grafiaLocal.has(normalizarOpcao(x))) resultado.adicionados.push(x);
    for (const x of local.valores) {
      if (!vistos.has(normalizarOpcao(x))) resultado.removidos.push({ indice: melhor, valor: x });
    }
    const igual = valores.length === local.valores.length && valores.every((x, i) => x === local.valores[i]);
    if (!igual) resultado.mudou = true;
    resultado.variacoes.push({ indice: melhor, coluna: col, tipo: local.tipo, valores });
  }
  return resultado;
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

// --- Importação de produtos novos -------------------------------------------

// A vitrine do fornecedor é um app de página única: não existe uma URL por
// produto de verdade, mas o link abre direto o produto certo pela
// referência (é o que o próprio site usa pra compartilhar um produto).
export function urlProdutoLoja(origem: string, referencia: string): string {
  return `${origem}/?produto=${encodeURIComponent(referencia)}`;
}

// Referência do produto a partir do link salvo aqui (o valor de
// "?produto="). null = link de outro formato.
export function referenciaDoLink(url: string): string | null {
  try {
    return new URL(url).searchParams.get("produto");
  } catch {
    return null;
  }
}

// Mesma loja e mesmo produto, com ou sem barra final, www ou não: vira a
// mesma chave.
export function chaveUrlFornecedor(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    const referencia = u.searchParams.get("produto");
    if (referencia) return `${host}?produto=${referencia.toLowerCase()}`;
    return `${host}${u.pathname.replace(/\/+$/, "")}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

// Preço daqui a partir do preço do fornecedor + margem em %.
export function precoComMargem(precoFornecedor: number, margemPct: number): number {
  return Math.round(precoFornecedor * (1 + margemPct / 100) * 100) / 100;
}
