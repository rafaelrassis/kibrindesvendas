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
