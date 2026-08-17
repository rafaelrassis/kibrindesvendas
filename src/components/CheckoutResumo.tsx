"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useProduto } from "@/lib/use-produto";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";
import { useConta } from "@/lib/conta-context";
import { useCep } from "@/lib/use-cep";
import { compararPreco } from "@/lib/compare-price";
import { formatarCep, normalizarCep } from "@/lib/frete";

function reais(valor: number) {
  return `R$ ${valor.toFixed(2).replace(".", ",")}`;
}

export default function CheckoutResumo({
  pagamentoReal,
  erroInicial = "",
}: {
  pagamentoReal: boolean;
  erroInicial?: string;
}) {
  const router = useRouter();
  const { item, limpar } = useCart();
  const { logado, carregando: carregandoAuth } = useAuth();
  const { enderecos } = useConta();
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState(erroInicial);

  const { produto, carregando } = useProduto(item?.produtoId);

  // Quem já tem endereço padrão salvo começa com ele preenchido; digitar por
  // cima assume o controle do campo (`null` = ainda não mexeu).
  const enderecoPadrao = enderecos.find((e) => e.padrao) ?? enderecos[0];
  const cepPadrao = enderecoPadrao ? normalizarCep(enderecoPadrao.cep) : null;
  const [cepDigitado, setCepDigitado] = useState<string | null>(null);
  const cep = cepDigitado ?? (cepPadrao ? formatarCep(cepPadrao) : "");

  const { endereco, erro: erroCep, consultando: consultandoCep } = useCep(cep);

  // O pedido é gravado no banco em nome do usuário, então quem tem sacola mas
  // não tem sessão passa pelo login antes de ver o resumo.
  useEffect(() => {
    if (!carregandoAuth && !logado && item) {
      router.replace("/entrar?next=/checkout");
    }
  }, [carregandoAuth, logado, item, router]);

  if (carregando) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center">
        <p className="text-ink/60">Carregando...</p>
      </div>
    );
  }

  // Sem item na sacola, ou com um item cujo produto saiu do catálogo — nos dois
  // casos não há o que fechar.
  if (!item || !produto) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center">
        {erro && <p className="text-sm text-berry mb-4">{erro}</p>}
        <p className="text-ink/60 mb-4">Seu carrinho está vazio.</p>
        <button
          onClick={() => router.push("/")}
          className="bg-pine text-paper px-6 py-2.5 rounded-full text-sm"
        >
          Ver produtos
        </button>
      </div>
    );
  }

  const precisaArte = produto.requerPersonalizacao && !item.personalizacao?.aceite;
  const comparacao = compararPreco(produto.precoShopee, produto.preco);
  const frete = endereco?.frete ?? null;
  const total = produto.preco + (frete?.valor ?? 0);

  function pagar() {
    // O botão já fica travado sem item e sem frete; a checagem sobra só pra
    // estreitar os tipos.
    if (!item || !endereco) return;
    setErro("");
    setProcessando(true);

    fetch("/api/pedidos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // O frete não vai no corpo de propósito: o servidor recalcula pelo CEP.
      body: JSON.stringify({ item, cep: normalizarCep(cep) }),
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          setErro(data.error ?? "Não foi possível concluir o pedido.");
          setProcessando(false);
          return;
        }
        limpar();
        // Pagamento real devolve a URL da página do Mercado Pago; o modo
        // simulado devolve a rota interna da confirmação. Nos dois casos é uma
        // navegação de verdade, então window.location dá conta dos dois.
        window.location.href = data.checkoutUrl;
      })
      .catch(() => {
        setErro("Não foi possível concluir o pedido. Tente novamente.");
        setProcessando(false);
      });
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <h1 className="font-display text-3xl mb-8">Finalizar pedido</h1>

      <div className="bg-white border border-line rounded-lg p-5 mb-5">
        <div className="flex gap-4">
          <div
            className="w-16 h-16 rounded-md flex items-center justify-center text-2xl shrink-0"
            style={{ backgroundColor: `${produto.cor}22` }}
          >
            {produto.emoji}
          </div>
          <div className="flex-1">
            <p className="font-medium">{produto.nome}</p>
            <p className="text-xs text-ink/50">
              {Object.entries(item.variacoesEscolhidas)
                .map(([k, v]) => `${k}: ${v}`)
                .join(" · ")}
            </p>
            {item.personalizacao && (
              <p className="text-xs text-pine-2 mt-1">✓ {item.personalizacao.resumo}</p>
            )}
          </div>
          <p className="font-mono font-medium">{reais(produto.preco)}</p>
        </div>
      </div>

      {precisaArte && (
        <div className="bg-berry/10 border border-berry/40 text-berry text-sm rounded-md px-4 py-3 mb-5">
          Falta definir e confirmar a arte antes de pagar.{" "}
          <button
            onClick={() => router.push(`/personalizar/${produto.id}`)}
            className="underline font-medium"
          >
            Voltar pra personalização
          </button>
        </div>
      )}

      <div className="bg-white border border-line rounded-lg p-5 mb-5">
        <p className="text-sm font-medium mb-3">Entrega</p>
        <label className="block">
          <span className="block text-xs text-ink/50 mb-1.5">CEP de entrega</span>
          <input
            value={cep}
            inputMode="numeric"
            maxLength={9}
            placeholder="00000-000"
            // `formatarCep` devolve o texto intacto enquanto não há 8 dígitos,
            // então o traço só aparece quando o CEP fica completo.
            onChange={(e) => setCepDigitado(formatarCep(e.target.value))}
            className="w-full max-w-[180px] bg-white border border-line rounded-lg px-4 py-3 text-sm outline-none focus:border-pine"
          />
        </label>

        {consultandoCep && <p className="text-xs text-ink/50 mt-2">Calculando frete...</p>}
        {erroCep && <p className="text-xs text-berry mt-2">{erroCep}</p>}

        {endereco && (
          <div className="mt-3 text-sm">
            <p className="text-ink/70">
              {[endereco.logradouro, endereco.bairro].filter(Boolean).join(", ")}
            </p>
            <p className="text-ink/70">
              {endereco.cidade}/{endereco.uf}
            </p>
            <p className="text-xs text-pine-2 mt-1.5">
              Entrega em até {endereco.frete.prazoDias} dias úteis após a postagem
            </p>
          </div>
        )}

        <p className="text-xs text-ink/40 mt-3">
          Estimativa por região — o valor final da postagem pode variar.
        </p>
      </div>

      {comparacao.mostrar && (
        <div className="bg-white border border-line rounded-lg p-5 mb-5">
          <p className="text-sm font-medium mb-3">Comparativo de preço</p>
          <div className="flex justify-between text-sm mb-1.5">
            <span className="text-ink/60">Na Shopee</span>
            <span className="line-through text-ink/40 font-mono">
              {reais(produto.precoShopee)}
            </span>
          </div>
          <div className="flex justify-between text-sm font-medium mb-1.5">
            <span>Aqui no site</span>
            <span className="font-mono text-pine-2">{reais(produto.preco)}</span>
          </div>
          <div className="flex justify-between text-sm text-berry">
            <span>Você economiza</span>
            <span className="font-mono">
              {reais(comparacao.economia ?? 0)} ({comparacao.percentual}%)
            </span>
          </div>
        </div>
      )}

      <div className="bg-white border border-line rounded-lg p-5 mb-5">
        <div className="flex justify-between text-sm mb-1.5">
          <span className="text-ink/60">Produto</span>
          <span className="font-mono">{reais(produto.preco)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-ink/60">Frete</span>
          <span className="font-mono">
            {frete ? reais(frete.valor) : <span className="text-ink/40">informe o CEP</span>}
          </span>
        </div>
        <div className="flex justify-between font-medium pt-3 mt-3 border-t border-line">
          <span>Total</span>
          <span className="font-mono">{reais(total)}</span>
        </div>
      </div>

      <div className="bg-white border border-line rounded-lg p-5 mb-8">
        <p className="text-sm font-medium mb-3">Pagamento</p>
        <div className="grid grid-cols-3 gap-2">
          {["Pix", "Cartão", "Boleto"].map((m) => (
            <div
              key={m}
              className="border border-line rounded-md py-2.5 text-sm text-center text-ink/60"
            >
              {m}
            </div>
          ))}
        </div>
        <p className="text-xs text-ink/40 mt-3">
          {pagamentoReal
            ? "Você escolhe a forma de pagamento na próxima tela, no ambiente seguro do Mercado Pago."
            : "Simulação — nenhum pagamento real é processado sem as credenciais do Mercado Pago."}
        </p>
      </div>

      {erro && <p className="text-sm text-berry mb-4">{erro}</p>}

      <button
        onClick={pagar}
        disabled={precisaArte || processando || !frete}
        className="w-full bg-berry text-paper font-medium px-8 py-3.5 rounded-full disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-95 transition"
      >
        {processando ? "Processando pagamento..." : `Pagar ${reais(total)}`}
      </button>
    </div>
  );
}
