"use client";

import { useRouter, useParams } from "next/navigation";
import { useConta } from "@/lib/conta-context";
import EnderecoForm from "@/components/EnderecoForm";

export default function EditarEnderecoPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
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
      <button
        onClick={() => router.push("/conta/enderecos")}
        className="text-sm text-ink/50 mb-4"
      >
        ← Voltar
      </button>
      <h1 className="font-display text-2xl mb-6">Editar endereço</h1>

      <EnderecoForm
        inicial={endereco}
        onSalvar={(dados) => {
          salvarEndereco(dados);
          router.push("/conta/enderecos");
        }}
        onExcluir={() => {
          removerEndereco(endereco.id);
          router.push("/conta/enderecos");
        }}
      />
    </div>
  );
}
