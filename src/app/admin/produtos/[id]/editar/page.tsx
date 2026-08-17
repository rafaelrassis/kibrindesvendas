import { notFound } from "next/navigation";
import AdminNav from "@/components/AdminNav";
import AdminProdutoForm from "@/components/AdminProdutoForm";
import { getProduto } from "@/lib/data/produtos";

export default async function EditarProdutoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const produto = await getProduto(id);
  if (!produto) notFound();

  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      <h1 className="font-display text-3xl mb-1">Editar produto</h1>
      <p className="text-ink/60 mb-2 text-sm">{produto.nome}</p>
      <AdminNav />
      <AdminProdutoForm produto={produto} />
    </div>
  );
}
