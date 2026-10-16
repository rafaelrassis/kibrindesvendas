"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { MOTIVOS_ABANDONO } from "@/lib/motivo-abandono";

function Conteudo() {
  const l = useSearchParams().get("l") ?? "";
  const [estado, setEstado] = useState<"perguntando" | "enviando" | "ok" | "erro">("perguntando");

  async function responder(motivo: string) {
    setEstado("enviando");
    try {
      const r = await fetch("/api/carrinho/motivo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ l, motivo }),
      });
      setEstado(r.ok ? "ok" : "erro");
    } catch {
      setEstado("erro");
    }
  }

  if (estado === "ok") {
    return (
      <>
        <h1 className="font-display text-2xl mb-3">Obrigado!</h1>
        <p className="text-ink/60 text-sm mb-6">Sua resposta ajuda a gente a melhorar a loja.</p>
        <Link href="/carrinho" className="bg-pine text-paper px-6 py-2.5 rounded-full text-sm">
          Voltar ao carrinho
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="font-display text-2xl mb-3">O que te impediu de finalizar?</h1>
      <p className="text-ink/60 text-sm mb-6">É rapidinho: um toque e pronto.</p>
      <div className="flex flex-col gap-2">
        {MOTIVOS_ABANDONO.map((m) => (
          <button
            key={m.valor}
            onClick={() => responder(m.valor)}
            disabled={estado === "enviando" || !l}
            className="border border-line rounded-full px-5 py-2.5 text-sm hover:border-pine disabled:opacity-40"
          >
            {m.rotulo}
          </button>
        ))}
      </div>
      {estado === "erro" && (
        <p className="text-xs text-berry mt-3">Não foi possível enviar agora. Tente de novo.</p>
      )}
    </>
  );
}

export default function MotivoPage() {
  return (
    <div className="mx-auto max-w-md px-5 py-16 text-center">
      <Suspense fallback={null}>
        <Conteudo />
      </Suspense>
    </div>
  );
}
