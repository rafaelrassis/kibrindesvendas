import type { Metadata } from "next";
import { getProduto } from "@/lib/data/produtos";
import ProdutoPageClient from "@/components/ProdutoPageClient";

// A tela de produto continua Client Component (estado de seleção, CEP,
// carrinho) — este arquivo só existe pra gerar metadata por produto, que
// exige Server Component. `getProduto` bate direto no banco, sem passar pela
// API pública.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const produto = await getProduto(id);

  if (!produto) {
    return { title: "Produto não encontrado — LeoKibrindes" };
  }

  const titulo = `${produto.nome} — LeoKibrindes`;
  const descricao = produto.descricao || `${produto.nome} personalizado na LeoKibrindes.`;
  const imagem = produto.imagens[0];

  return {
    title: titulo,
    description: descricao,
    alternates: { canonical: `/produto/${produto.id}` },
    openGraph: {
      title: titulo,
      description: descricao,
      type: "website",
      images: imagem ? [{ url: imagem }] : undefined,
    },
    twitter: {
      card: imagem ? "summary_large_image" : "summary",
      title: titulo,
      description: descricao,
      images: imagem ? [imagem] : undefined,
    },
  };
}

export default function ProdutoPage() {
  return <ProdutoPageClient />;
}
