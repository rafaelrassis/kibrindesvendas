export type Variacao = {
  tipo: string;
  valores: string[];
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
  precoShopee: number;
  // Desligado, o site nunca mostra o comparativo de preço deste produto.
  vendidoNaShopee: boolean;
  requerPersonalizacao: boolean;
  emoji: string;
  cor: string;
  variacoes: Variacao[];
  destaque?: boolean;
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
  tipo: "PERCENTUAL" | "FIXO";
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
  desconto: number;
  cupomCodigo: string | null;
  enderecoResumo: string | null;
  motivoDevolucao: string | null;
  pagamentoMock: boolean;
  createdAt: string;
  itens: ItemPedido[];
};
