"use client";

import { Suspense } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useConta } from "@/lib/conta-context";
import EnderecoForm from "@/components/EnderecoForm";

function EditarEnderecoConteudo() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  // `next` volta pro checkout quando a edição foi aberta de lá — sem ele, cai
  // na lista de sempre.
  const proxima = searchParams.get("next") || "/conta/enderecos";
  const { enderecos, salvarEndereco, removerEndereco } = useConta();

  const endereco = enderecos.find((e) => e.id === params.id);

  if (!endereco) {
    return (
      <div className="mx-auto max-w-md px-5 py-16 text-center">
        <p className="text-ink/60 text-sm mb-6">Endereço não encontrado.</p>
        <button
          onClick={() => router.push("/conta/enderecos")}
          className="bg-pine text-paper px-6 py-2.5 rounded-full text-sm"
        >
          Voltar aos endereços
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-5 py-8">
      <button onClick={() => router.push(proxima)} className="text-sm text-ink/50 mb-4">
        ← Voltar
      </button>
      <h1 className="font-display text-2xl mb-6">Editar endereço</h1>

      <EnderecoForm
        inicial={endereco}
        onSalvar={async (dados) => {
          await salvarEndereco(dados);
          router.push(proxima);
        }}
        onExcluir={async () => {
          await removerEndereco(endereco.id);
          router.push("/conta/enderecos");
        }}
      />
    </div>
  );
}

export default function EditarEnderecoPage() {
  return (
    <Suspense>
      <EditarEnderecoConteudo />
    </Suspense>
  );
}
