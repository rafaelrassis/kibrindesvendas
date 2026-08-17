"use client";

import { useRouter } from "next/navigation";
import { useConta } from "@/lib/conta-context";
import type { Preferencias } from "@/lib/conta-data";

const opcoes: { chave: keyof Preferencias; label: string; sublabel: string }[] = [
  {
    chave: "email",
    label: "E-mail",
    sublabel: "Confirmações e atualizações de pedido",
  },
  {
    chave: "whatsapp",
    label: "WhatsApp",
    sublabel: "Avisos de produção e envio",
  },
  {
    chave: "sms",
    label: "SMS",
    sublabel: "Alertas de entrega",
  },
  {
    chave: "promocoes",
    label: "Promoções e novidades",
    sublabel: "Ofertas e lançamentos da loja",
  },
];

export default function PreferenciasPage() {
  const router = useRouter();
  const { preferencias, atualizarPreferencias } = useConta();

  function alternar(chave: keyof Preferencias) {
    atualizarPreferencias({ ...preferencias, [chave]: !preferencias[chave] });
  }

  return (
    <div className="mx-auto max-w-md px-5 py-8">
      <button onClick={() => router.push("/conta")} className="text-sm text-ink/50 mb-4">
        ← Voltar
      </button>
      <h1 className="font-display text-2xl mb-1">Notificações</h1>
      <p className="text-ink/60 text-sm mb-6">
        Escolha como quer ser avisado sobre seus pedidos.
      </p>

      <div className="bg-white border border-line rounded-lg divide-y divide-line">
        {opcoes.map((o) => (
          <label
            key={o.chave}
            className="flex items-center gap-4 px-4 py-4 cursor-pointer"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm">{o.label}</p>
              <p className="text-xs text-ink/50 mt-0.5">{o.sublabel}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={preferencias[o.chave]}
              onClick={() => alternar(o.chave)}
              className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                preferencias[o.chave] ? "bg-pine" : "bg-line"
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                  preferencias[o.chave] ? "translate-x-[22px]" : "translate-x-0.5"
                }`}
              />
            </button>
          </label>
        ))}
      </div>
    </div>
  );
}
