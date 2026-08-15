"use client";

import { useState } from "react";
import { faqs } from "@/lib/mock-data";

export default function SuportePage() {
  const [aberta, setAberta] = useState<number | null>(0);

  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <h1 className="font-display text-3xl mb-2">Suporte / FAQ</h1>
      <p className="text-ink/60 mb-8">
        Dúvidas mais comuns. Não encontrou o que precisa? Chama no WhatsApp.
      </p>

      <div className="space-y-3">
        {faqs.map((f, i) => (
          <div key={f.pergunta} className="bg-white border border-line rounded-lg overflow-hidden">
            <button
              onClick={() => setAberta(aberta === i ? null : i)}
              className="w-full text-left px-5 py-4 flex justify-between items-center gap-4"
            >
              <span className="font-medium text-sm">{f.pergunta}</span>
              <span className="text-ink/40">{aberta === i ? "−" : "+"}</span>
            </button>
            {aberta === i && (
              <p className="px-5 pb-4 text-sm text-ink/60">{f.resposta}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
