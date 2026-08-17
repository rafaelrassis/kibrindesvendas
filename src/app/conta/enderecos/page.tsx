"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, MapPin, Star } from "lucide-react";
import { useConta } from "@/lib/conta-context";

export default function EnderecosPage() {
  const router = useRouter();
  const { enderecos, definirEnderecoPadrao } = useConta();

  return (
    <div className="mx-auto max-w-md px-5 py-8">
      <button onClick={() => router.push("/conta")} className="text-sm text-ink/50 mb-4">
        ← Voltar
      </button>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl">Endereços</h1>
        <Link
          href="/conta/enderecos/novo"
          className="flex items-center gap-1.5 bg-pine text-paper text-xs px-3.5 py-2 rounded-full"
        >
          <Plus size={14} />
          Novo
        </Link>
      </div>

      {enderecos.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-4">📍</p>
          <p className="text-ink/60 text-sm mb-6">
            Você ainda não salvou nenhum endereço.
          </p>
          <Link
            href="/conta/enderecos/novo"
            className="bg-pine text-paper px-6 py-2.5 rounded-full text-sm inline-block"
          >
            Adicionar endereço
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {enderecos.map((e) => (
            <div key={e.id} className="bg-white border border-line rounded-lg p-4">
              <div className="flex items-start gap-3">
                <span className="w-9 h-9 rounded-full bg-paper-2 text-pine flex items-center justify-center shrink-0">
                  <MapPin size={16} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{e.rotulo}</p>
                    {e.padrao && (
                      <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-mustard bg-mustard/10 px-2 py-0.5 rounded-full">
                        <Star size={10} />
                        Padrão
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-ink/60 mt-0.5">
                    {e.rua}, {e.numero}
                    {e.complemento && ` — ${e.complemento}`}
                  </p>
                  <p className="text-xs text-ink/60">
                    {e.bairro}, {e.cidade}/{e.uf} — {e.cep}
                  </p>
                  <div className="flex items-center gap-4 mt-3">
                    <Link
                      href={`/conta/enderecos/${e.id}`}
                      className="text-xs text-pine font-medium"
                    >
                      Editar
                    </Link>
                    {!e.padrao && (
                      <button
                        onClick={() => definirEnderecoPadrao(e.id)}
                        className="text-xs text-ink/50"
                      >
                        Tornar padrão
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
