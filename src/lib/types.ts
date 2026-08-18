export type Variacao = {
  tipo: string;
  valores: string[];
};

export type Produto = {
  id: string;
  nome: string;
  descricao: string;
  categoria: string;
  categoriaLabel: string;
  preco: number;
  precoShopee: number;
  // Desligado, o site nunca mostra o comparativo de preço deste produto.
  vendidoNaShopee: boolean;
  requerPersonalizacao: boolean;
  emoji: string;
  cor: string;
  variacoes: Variacao[];
  destaque?: boolean;
};

export type Categoria = {
  slug: string;
  label: string;
  emoji: string;
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
  enderecoResumo: string | null;
  motivoDevolucao: string | null;
  pagamentoMock: boolean;
  createdAt: string;
  itens: ItemPedido[];
};
