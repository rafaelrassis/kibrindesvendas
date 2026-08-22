import FaqAcordeao from "@/components/FaqAcordeao";
import { getFaqsAtivas } from "@/lib/data/faq";

// FAQ vem do banco (cadastrada em /admin/faqs) — mudar uma resposta ou
// adicionar pergunta não pede redeploy, igual banner e cupom.
export const revalidate = 60;

export default async function SuportePage() {
  const faqs = await getFaqsAtivas();

  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <h1 className="font-display text-3xl mb-2">Suporte / FAQ</h1>
      <p className="text-ink/60 mb-8">
        Dúvidas mais comuns. Não encontrou o que precisa? Chama no WhatsApp.
      </p>

      <FaqAcordeao faqs={faqs} />
    </div>
  );
}
