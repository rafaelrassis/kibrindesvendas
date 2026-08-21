export type Variacao = {
  tipo: string;
  valores: string[];
  // Foto por valor — só usado quando tipo é "Cor" (case-insensitive).
  // Valor sem entrada aqui cai no chip de texto de sempre.
  imagensValores?: Record<string, string> | null;
};

// Estoque de uma combinação específica (ex: Cor=Preta + Tamanho=G).
// `combinacao` é a chave gerada por buildCombinacaoKey — ver
// lib/estoque-variacao.ts.
export type EstoqueVariacaoItem = {
  combinacao: string;
  estoque: number;
};

export type Produto = {
  id: string;
  nome: string;
  descricao: string;
  // Texto mais longo pra seção "Detalhes do produto"; ausente em produtos
  // antigos que nunca foram editados depois desse campo existir.
  descricaoDetalhada: string | null;
  categoria: string;
  categoriaLabel: string;
  preco: number;
  precoOriginal: number | null;
  precoShopee: number;
  // Desligado, o site nunca mostra o comparativo de preço deste produto.
  vendidoNaShopee: boolean;
  requerPersonalizacao: boolean;
  emoji: string;
  cor: string;
  // Galeria de mídia: até 4 fotos (nessa ordem) e 1 vídeo. Sem nada aqui, a
  // vitrine cai no emoji + cor de sempre.
  imagens: string[];
  video: string | null;
  variacoes: Variacao[];
  destaque?: boolean;
  // null = estoque não controlado (comportamento de sempre). Com um número,
  // a compra não passa disso — ver checarEstoque / decrementarEstoque.
  // Só vale pra produto SEM variações — com variações, o controle é por
  // combinação (ver estoqueVariacoes) e este campo fica sempre null.
  estoque: number | null;
  // Uma linha por combinação de variação com controle ligado. Vazio = sem
  // controle por variação (produto sem variações, ou variações sem
  // controle de estoque ligado) — ver estoque-variacao.ts.
  estoqueVariacoes: EstoqueVariacaoItem[];
  // Usados na cotação de frete real (Correios via Melhor Envio).
  pesoGramas: number;
  alturaCm: number;
  larguraCm: number;
  comprimentoCm: number;
};

export type MaterialProduto = {
  id: string;
  nome: string;
  quantidade: number;
  custoUnitario: number;
};

// Versão do produto só pra telas /admin: inclui o custo de material, dado
// interno que nunca deve sair pela API pública (/api/produtos).
export type ProdutoAdmin = Produto & {
  materiais: MaterialProduto[];
  custoTotal: number;
  lucro: number;
  margemPercentual: number | null;
};

export type Cupom = {
  id: string;
  codigo: string;
  tipo: "PERCENTUAL" | "FIXO" | "FRETE_GRATIS";
  valor: number;
  ativo: boolean;
  validoAte: string | null;
  usoMaximo: number | null;
  usos: number;
  valorMinimoPedido: number;
  createdAt: string;
};

export type Categoria = {
  slug: string;
  label: string;
  imagemUrl: string | null;
};

// Slide do carrossel da home, como a loja recebe.
export type Banner = {
  id: string;
  titulo: string;
  eyebrow: string;
  precoTexto: string;
  ctaHref: string;
  imagemUrl: string | null;
  corFundo: string;
};

// O mesmo slide na área interna, onde posição e visibilidade também aparecem.
export type BannerAdmin = Banner & {
  ordem: number;
  ativo: boolean;
};

export type ItemPedido = {
  id: string;
  quantidade: number;
  precoUnitario: number;
  variacoes: Record<string, string>;
  produto: { id: string; nome: string; emoji: string; cor: string };
  personalizacao: { tipo: string; briefing: string | null; arteUrl: string | null } | null;
};

// O pedido como as telas do cliente recebem pela API: Decimal e Date do banco
// já convertidos pro que sobrevive ao JSON (ver paraPedidoPublico).
export type Pedido = {
  id: string;
  status: string;
  total: number;
  frete: number;
  // Frete cobrado zerado (cupom de frete grátis ou limiar automático) — sem
  // isso, um `frete: 0` no histórico pareceria erro de cálculo em vez de
  // benefício aplicado.
  freteGratis: boolean;
  desconto: number;
  cupomCodigo: string | null;
  enderecoResumo: string | null;
  motivoDevolucao: string | null;
  pagamentoMock: boolean;
  createdAt: string;
  itens: ItemPedido[];
};
