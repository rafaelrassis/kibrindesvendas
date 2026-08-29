"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useConta } from "@/lib/conta-context";
import { novoIdEndereco, type Endereco } from "@/lib/conta-data";
import EnderecoForm from "@/components/EnderecoForm";

const vazio: Endereco = {
  id: "",
  rotulo: "",
  destinatario: "",
  cep: "",
  rua: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
  padrao: false,
};

function NovoEnderecoConteudo() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // `next` volta pro checkout quando o cadastro foi aberto de lá (endereço
  // obrigatório pra fechar o pedido) — sem ele, cai na lista de sempre.
  const proxima = searchParams.get("next") || "/conta/enderecos";
  const { salvarEndereco } = useConta();

  return (
    <div className="mx-auto max-w-md px-5 py-8">
      <button onClick={() => router.push(proxima)} className="text-sm text-ink/50 mb-4">
        ← Voltar
      </button>
      <h1 className="font-display text-2xl mb-6">Novo endereço</h1>

      <EnderecoForm
        inicial={{ ...vazio, id: novoIdEndereco() }}
        onSalvar={async (endereco) => {
          await salvarEndereco(endereco);
          router.push(proxima);
        }}
      />
    </div>
  );
}

export default function NovoEnderecoPage() {
  return (
    <Suspense>
      <NovoEnderecoConteudo />
    </Suspense>
  );
}
