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
