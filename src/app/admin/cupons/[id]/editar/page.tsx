import { notFound } from "next/navigation";
import AdminNav from "@/components/AdminNav";
import AdminCupomForm from "@/components/AdminCupomForm";
import { getCupom } from "@/lib/data/cupons";
import { exigirAdmin } from "@/lib/admin";

export default async function EditarCupomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigirAdmin();

  const { id } = await params;
  const cupom = await getCupom(id);
  if (!cupom) notFound();

  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      <h1 className="font-display text-3xl mb-1">Editar cupom</h1>
      <p className="text-ink/60 mb-2 text-sm font-mono">{cupom.codigo}</p>
      <AdminNav />
      <AdminCupomForm cupom={cupom} />
    </div>
  );
}
