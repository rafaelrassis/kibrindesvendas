// Tipos vivem em @/lib/types — mantidos re-exportados aqui por compatibilidade.
import type { Produto } from "./types";
export type { Variacao, Produto } from "./types";

// ⚠️ Este arquivo não é mais a fonte de dados da aplicação (ver src/lib/data/).
// Fica só como seed inicial do banco (prisma/seed.ts usa estes arrays).

export const categorias = [
  { slug: "imas", label: "Ímãs de geladeira", emoji: "🧲" },
  { slug: "canecas", label: "Canecas", emoji: "☕" },
  { slug: "camisetas", label: "Camisetas", emoji: "👕" },
  { slug: "moletons", label: "Moletons", emoji: "🧥" },
];

export const produtos: Produto[] = [
  {
    id: "ima-pet-01",
    nome: "Ímã Pet Retrato",
    descricao:
      "Ímã de geladeira com o retrato do seu bichinho, em resina de alta durabilidade.",
    descricaoDetalhada: null,
    categoria: "imas",
    categoriaLabel: "Ímãs de geladeira",
    preco: 24.9,
    precoShopee: 34.9,
    vendidoNaShopee: true,
    requerPersonalizacao: true,
    emoji: "🐾",
    cor: "#D9A63E",
    variacoes: [
      { tipo: "Tamanho", valores: ["6x6cm", "8x8cm", "10x10cm"] },
      { tipo: "Formato", valores: ["Redondo", "Quadrado", "Osso"] },
    ],
    destaque: true,
  },
  {
    id: "ima-casal-02",
    nome: "Ímã Casal Caricatura",
    descricao: "Caricatura estilo cartoon do casal, perfeita pra presentear.",
    descricaoDetalhada: null,
    categoria: "imas",
    categoriaLabel: "Ímãs de geladeira",
    preco: 29.9,
    precoShopee: 42.9,
    vendidoNaShopee: true,
    requerPersonalizacao: true,
    emoji: "💑",
    cor: "#B23A48",
    variacoes: [{ tipo: "Tamanho", valores: ["8x8cm", "10x10cm"] }],
    destaque: true,
  },
  {
    id: "ima-familia-03",
    nome: "Ímã Família Aquarela",
    descricao: "Toda a família em estilo aquarela num ímã de geladeira.",
    descricaoDetalhada: null,
    categoria: "imas",
    categoriaLabel: "Ímãs de geladeira",
    preco: 34.9,
    precoShopee: 49.9,
    vendidoNaShopee: true,
    requerPersonalizacao: true,
    emoji: "👨‍👩‍👧",
    cor: "#3F6B4C",
    variacoes: [{ tipo: "Tamanho", valores: ["10x10cm", "12x12cm"] }],
  },
  {
    id: "caneca-pet-01",
    nome: "Caneca Personalizada Pet",
    descricao: "Caneca de porcelana com a foto do seu pet impressa.",
    descricaoDetalhada: null,
    categoria: "canecas",
    categoriaLabel: "Canecas",
    preco: 39.9,
    precoShopee: 54.9,
    vendidoNaShopee: true,
    requerPersonalizacao: true,
    emoji: "☕",
    cor: "#8C5A3C",
    variacoes: [{ tipo: "Cor da alça", valores: ["Branca", "Preta", "Vermelha"] }],
    destaque: true,
  },
  {
    id: "camiseta-basica-01",
    nome: "Camiseta Básica Algodão",
    descricao: "Camiseta 100% algodão, corte unissex, pronta entrega.",
    descricaoDetalhada: null,
    categoria: "camisetas",
    categoriaLabel: "Camisetas",
    preco: 44.9,
    precoShopee: 59.9,
    vendidoNaShopee: true,
    requerPersonalizacao: false,
    emoji: "👕",
    cor: "#2E4A3D",
    variacoes: [
      { tipo: "Tamanho", valores: ["P", "M", "G", "GG"] },
      { tipo: "Cor", valores: ["Branca", "Preta", "Cinza"] },
    ],
  },
  {
    id: "camiseta-custom-02",
    nome: "Camiseta Estampa Personalizada",
    descricao: "Manda sua arte ou gera com IA pra estampar na camiseta.",
    descricaoDetalhada: null,
    categoria: "camisetas",
    categoriaLabel: "Camisetas",
    preco: 54.9,
    precoShopee: 74.9,
    vendidoNaShopee: true,
    requerPersonalizacao: true,
    emoji: "🎨",
    cor: "#C2385A",
    variacoes: [
      { tipo: "Tamanho", valores: ["P", "M", "G", "GG"] },
      { tipo: "Cor", valores: ["Branca", "Preta"] },
    ],
    destaque: true,
  },
  {
    id: "moletom-custom-01",
    nome: "Moletom Personalizado",
    descricao: "Moletom canguru com estampa personalizada, quentinho pro inverno.",
    descricaoDetalhada: null,
    categoria: "moletons",
    categoriaLabel: "Moletons",
    preco: 129.9,
    precoShopee: 169.9,
    vendidoNaShopee: true,
    requerPersonalizacao: true,
    emoji: "🧥",
    cor: "#1F2E27",
    variacoes: [
      { tipo: "Tamanho", valores: ["P", "M", "G", "GG"] },
      { tipo: "Cor", valores: ["Cinza mescla", "Preto"] },
    ],
  },
];

// Carrossel inicial da home. Depois do seed é tudo editável em /admin/banners,
// e o seed não mexe mais neles (ver prisma/seed.ts).
export const banners = [
  {
    id: "banner-imas",
    titulo: "Ímãs personalizados",
    eyebrow: "Tudo pra presentear",
    precoTexto: "A partir de R$ 24,90",
    ctaHref: "/categoria/imas",
    corFundo: "#9C1C95",
    ordem: 0,
  },
  {
    id: "banner-canecas",
    titulo: "Canecas com sua foto",
    eyebrow: "Novidade",
    precoTexto: "A partir de R$ 29,90",
    ctaHref: "/categoria/canecas",
    corFundo: "#D9A63E",
    ordem: 1,
  },
  {
    id: "banner-moletons",
    titulo: "Moletons personalizados",
    eyebrow: "Fim de semana",
    precoTexto: "A partir de R$ 89,90",
    ctaHref: "/categoria/moletons",
    corFundo: "#7A1674",
    ordem: 2,
  },
];

export const faqs = [
  {
    pergunta: "Quanto tempo leva pra produzir meu pedido?",
    resposta:
      "Produtos prontos enviamos em até 2 dias úteis. Produtos personalizados entram em produção assim que a arte é validada, com prazo médio de 5 dias úteis.",
  },
  {
    pergunta: "Posso enviar minha própria arte?",
    resposta:
      "Sim! Na etapa de personalização você escolhe 'Enviar arte pronta', faz o upload e confirma o aceite. A arte é impressa exatamente como enviada.",
  },
  {
    pergunta: "E se a minha arte estiver com problema?",
    resposta:
      "Nossa equipe confere resolução, enquadramento e legibilidade antes de imprimir. Se algo estiver fora do padrão, entramos em contato pelo WhatsApp antes de seguir.",
  },
  {
    pergunta: "A prévia gerada por IA é igual ao produto final?",
    resposta:
      "É uma simulação e pode variar um pouco do resultado impresso, principalmente em produtos têxteis como camisetas e moletons.",
  },
  {
    pergunta: "Por que o preço aqui é menor que na Shopee?",
    resposta:
      "Vendemos os mesmos produtos por um preço menor no site porque não pagamos a taxa da plataforma. A Shopee continua sendo uma opção com toda a proteção de compra de lá.",
  },
];

export function getProduto(id: string) {
  return produtos.find((p) => p.id === id);
}

export function getProdutosPorCategoria(slug: string) {
  return produtos.filter((p) => p.categoria === slug);
}
