export type Variacao = {
  tipo: string;
  valores: string[];
  // Fotos por valor — só usado quando tipo é "Cor" (case-insensitive). Até 4
  // fotos por valor de cor (mesmo limite da galeria principal do produto);
  // ao selecionar a cor, a galeria grande passa a mostrar essas fotos.
  // Valor sem entrada aqui cai no chip de texto de sempre.
  imagensValores?: Record<string, string[]> | null;
  // Preço final por valor (substitui produto.preco quando o valor escolhido
  // tem entrada aqui). Ex: "7x7" => 1, "10x10" => 5. Sem entrada, usa o
  // preço normal do produto — ver precoEfetivo em estoque-variacao.ts.
  precosValores?: Record<string, number> | null;
  // Custo de material final por valor (substitui custoTotal quando o valor
  // escolhido tem entrada aqui). Dado interno de admin — nunca populado na
  // versão pública do produto (ver toDomainProduto). Ver custoEfetivo em
  // estoque-variacao.ts.
  custosValores?: Record<string, number> | null;
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
  // Texto do alerta de personalização. null = usa o texto padrão.
  mensagemPersonalizacao: string | null;
  // Dias extras de produção somados ao prazo de frete quando o produto exige
  // personalização. 0 = não soma nada.
  diasProducaoExtra: number;
  // Menor quantidade que dá pra levar deste produto. 1 = sem pedido mínimo.
  quantidadeMinima: number;
  // true = seletor de quantidade vira campo numérico livre em vez do
  // stepper +/-, pra pedido grande sem clicar um por um.
  quantidadePersonalizavel: boolean;
  emoji: string;
  cor: string;
  // Galeria de mídia: até 4 fotos (nessa ordem) e 1 vídeo. Sem nada aqui, a
  // vitrine cai no emoji + cor de sempre.
  imagens: string[];
  video: string | null;
  variacoes: Variacao[];
  destaque?: boolean;
  destaqueCategoria?: boolean;
  // false = pausado, some da loja mas continua no admin.
  ativo: boolean;
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
  pesoMiligramas: number;
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
  // Override de margem Shopee deste produto — null = usa o default global
  // da loja (ver ConfiguracaoLoja.shopeeComissaoPct e cia).
  shopeeComissaoPct: number | null;
  shopeeFretePct: number | null;
  shopeeAdsPct: number | null;
  // CEP de despacho deste produto, quando difere do CEP padrão da loja
  // (fornecedor terceirizado). null = usa o CEP padrão.
  cepOrigemOverride: string | null;
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

// Pergunta/resposta da página /suporte, como a loja recebe.
export type Faq = {
  id: string;
  pergunta: string;
  resposta: string;
};

// A mesma FAQ na área interna, onde posição e visibilidade também aparecem.
export type FaqAdmin = Faq & {
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
  // Nome do serviço cotado (ex: "PAC", "SEDEX", "Estimativa") — null quando
  // o frete saiu grátis.
  freteServico: string | null;
  // Frete cobrado zerado (cupom de frete grátis ou limiar automático) — sem
  // isso, um `frete: 0` no histórico pareceria erro de cálculo em vez de
  // benefício aplicado.
  freteGratis: boolean;
  desconto: number;
  cupomCodigo: string | null;
  enderecoResumo: string | null;
  motivoDevolucao: string | null;
  // Código dos Correios (ou da transportadora cotada), preenchido pelo admin
  // depois que o pedido é despachado. null até lá.
  codigoRastreio: string | null;
  pagamentoMock: boolean;
  createdAt: string;
  itens: ItemPedido[];
};
