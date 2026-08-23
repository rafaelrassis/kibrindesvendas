"use client";

import { useRouter } from "next/navigation";
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

export default function NovoEnderecoPage() {
  const router = useRouter();
  const { salvarEndereco } = useConta();

  return (
    <div className="mx-auto max-w-md px-5 py-8">
      <button
        onClick={() => router.push("/conta/enderecos")}
        className="text-sm text-ink/50 mb-4"
      >
        ← Voltar
      </button>
      <h1 className="font-display text-2xl mb-6">Novo endereço</h1>

      <EnderecoForm
        inicial={{ ...vazio, id: novoIdEndereco() }}
        onSalvar={async (endereco) => {
          await salvarEndereco(endereco);
          router.push("/conta/enderecos");
        }}
      />
    </div>
  );
}
