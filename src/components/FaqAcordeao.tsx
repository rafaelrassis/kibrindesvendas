"use client";

import { useState } from "react";
import type { Faq } from "@/lib/types";

export default function FaqAcordeao({ faqs }: { faqs: Faq[] }) {
  const [aberta, setAberta] = useState<number | null>(0);

  if (faqs.length === 0) {
    return (
      <p className="text-sm text-ink/50">
        Nenhuma pergunta cadastrada no momento — chama no WhatsApp que a gente responde.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {faqs.map((f, i) => (
        <div key={f.id} className="bg-white border border-line rounded-lg overflow-hidden">
          <button
            onClick={() => setAberta(aberta === i ? null : i)}
            className="w-full text-left px-5 py-4 flex justify-between items-center gap-4"
          >
            <span className="font-medium text-sm">{f.pergunta}</span>
            <span className="text-ink/40">{aberta === i ? "−" : "+"}</span>
          </button>
          {aberta === i && <p className="px-5 pb-4 text-sm text-ink/60">{f.resposta}</p>}
        </div>
      ))}
    </div>
  );
}
