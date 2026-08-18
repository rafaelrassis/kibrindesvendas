import AdminNav from "@/components/AdminNav";
import AdminCupomForm from "@/components/AdminCupomForm";

export default function NovoCupomPage() {
  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      <h1 className="font-display text-3xl mb-1">Novo cupom</h1>
      <p className="text-ink/60 mb-2 text-sm">Área interna.</p>
      <AdminNav />
      <AdminCupomForm />
    </div>
  );
}
