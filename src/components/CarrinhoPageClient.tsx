"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart-context";
import { useProdutos } from "@/lib/use-produtos";
import { precoEfetivo } from "@/lib/estoque-variacao";
import QuantidadeItem from "@/components/QuantidadeItem";
import SugestoesCarrinho from "@/components/SugestoesCarrinho";
import SalvarCarrinhoPorEmail from "@/components/SalvarCarrinhoPorEmail";
import { avisosDaLinha, faltaParaFreteGratis } from "@/lib/carrinho-avisos";

function reais(valor: number) {
  return `R$ ${valor.toFixed(2).replace(".", ",")}`;
}

export default function CarrinhoPageClient({
  freteGratisAcimaDe = null,
}: {
  freteGratisAcimaDe?: number | null;
}) {
  const router = useRouter();
  const { itens, definirQuantidade, removerItem, atualizarPreco } = useCart();
  const { produtos, carregando } = useProdutos(itens.map((i) => i.produtoId));

  if (itens.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center">
        <p className="text-4xl mb-3" aria-hidden="true">
          🛒
        </p>
        <h1 className="font-display text-2xl mb-2">Seu carrinho está vazio</h1>
        <p className="text-ink/60 mb-6 text-sm">Escolha um produto pra começar.</p>
        <button
          onClick={() => router.push("/")}
          className="bg-pine text-paper px-6 py-2.5 rounded-full text-sm"
        >
          Ver produtos
        </button>
      </div>
    );
  }

  if (carregando) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center">
        <p className="text-ink/60">Carregando...</p>
      </div>
    );
  }

  // Linha cujo produto saiu do catálogo (ou foi pausado): não dá pra comprar,
  // então sai do total e trava o checkout até ser removida.
  const indisponiveis = itens.filter((i) => !produtos[i.produtoId]);
  const semArte = itens.filter((i) => {
    const produto = produtos[i.produtoId];
    return produto?.requerPersonalizacao && !i.personalizacao?.aceite;
  });

  const subtotal = itens.reduce((soma, i) => {
    const produto = produtos[i.produtoId];
    if (!produto) return soma;
    return soma + precoEfetivo(produto, i.variacoesEscolhidas) * i.quantidade;
  }, 0);

  const bloqueadas = itens.filter((i) => {
    const produto = produtos[i.produtoId];
    return produto ? avisosDaLinha(produto, i).bloqueia : false;
  });
  const podeFinalizar =
    indisponiveis.length === 0 && semArte.length === 0 && bloqueadas.length === 0;
  const falta = faltaParaFreteGratis(subtotal, freteGratisAcimaDe);

  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <h1 className="font-display text-3xl mb-8">Carrinho</h1>

      {freteGratisAcimaDe !== null && (
        <div
          className="bg-white border border-line rounded-lg px-5 py-4 mb-5"
          role="status"
          aria-live="polite"
        >
          {falta === null ? (
            <p className="text-sm text-pine-2 font-medium">🎉 Você ganhou frete grátis!</p>
          ) : (
            <>
              <p className="text-sm">
                Faltam <span className="font-mono font-medium">{reais(falta)}</span> pra ganhar{" "}
                <span className="font-medium">frete grátis</span>.
              </p>
              <div className="h-1.5 rounded-full bg-line mt-2.5 overflow-hidden">
                <div
                  className="h-full bg-pine rounded-full transition-all"
                  style={{ width: `${Math.min(100, (subtotal / freteGratisAcimaDe) * 100)}%` }}
                />
              </div>
            </>
          )}
        </div>
      )}

      <div className="space-y-3 mb-5">
        {itens.map((item) => {
          const produto = produtos[item.produtoId];

          if (!produto) {
            return (
              <div
                key={item.id}
                className="bg-white border border-line rounded-lg p-5 flex items-center justify-between gap-4"
              >
                <p className="text-sm text-ink/60">Este produto não está mais disponível.</p>
                <button
                  onClick={() => removerItem(item.id)}
                  className="text-xs text-berry hover:underline shrink-0"
                >
                  Remover
                </button>
              </div>
            );
          }

          const precoUnitario = precoEfetivo(produto, item.variacoesEscolhidas);
          const variacoes = Object.entries(item.variacoesEscolhidas)
            .map(([k, v]) => `${k}: ${v}`)
            .join(" · ");
          const precisaArte = produto.requerPersonalizacao && !item.personalizacao?.aceite;
          const avisos = avisosDaLinha(produto, item);

          return (
            <div key={item.id} className="bg-white border border-line rounded-lg p-5">
              <div className="flex gap-4">
                <Link
                  href={`/produto/${produto.id}`}
                  className="w-16 h-16 rounded-md flex items-center justify-center text-2xl shrink-0 overflow-hidden"
                  style={{ backgroundColor: `${produto.cor}22` }}
                >
                  {produto.imagens[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={produto.imagens[0]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    produto.emoji
                  )}
                </Link>
                <div className="flex-1 min-w-0">
                  <Link href={`/produto/${produto.id}`} className="font-medium hover:underline">
                    {produto.nome}
                  </Link>
                  {variacoes && <p className="text-xs text-ink/50">{variacoes}</p>}
                  {item.personalizacao && (
                    <p className="text-xs text-pine-2 mt-1">✓ {item.personalizacao.resumo}</p>
                  )}
                  {precisaArte && (
                    <p className="text-xs text-berry mt-1">
                      Falta definir a arte.{" "}
                      <Link href={`/personalizar/${produto.id}`} className="underline font-medium">
                        Personalizar
                      </Link>
                    </p>
                  )}
                  <QuantidadeItem
                    produto={produto}
                    variacoesEscolhidas={item.variacoesEscolhidas}
                    quantidade={item.quantidade}
                    onChange={(q) => definirQuantidade(item.id, q)}
                  />
                  {avisos.esgotado && (
                    <p className="text-xs text-berry mt-2">
                      Esgotado no momento. Remova pra continuar.
                    </p>
                  )}
                  {avisos.excede !== null && (
                    <p className="text-xs text-berry mt-2">
                      Só restam {avisos.excede} unidade(s).{" "}
                      {!produto.requerPersonalizacao && (
                        <button
                          onClick={() => definirQuantidade(item.id, avisos.excede!)}
                          className="underline font-medium"
                        >
                          Ajustar pra {avisos.excede}
                        </button>
                      )}
                    </p>
                  )}
                  {avisos.estoqueBaixo !== null && (
                    <p className="text-xs text-ink/70 mt-2">
                      Últimas {avisos.estoqueBaixo} unidade(s) em estoque.
                    </p>
                  )}
                  {avisos.precoMudou && (
                    <p className="text-xs text-ink/70 mt-2 bg-mustard/15 rounded-md px-2.5 py-1.5">
                      O preço mudou de{" "}
                      <span className="font-mono">{reais(avisos.precoMudou.de)}</span> para{" "}
                      <span className="font-mono font-medium">{reais(avisos.precoMudou.para)}</span>.{" "}
                      <button
                        onClick={() => atualizarPreco(item.id, avisos.precoMudou!.para)}
                        className="underline font-medium"
                      >
                        Ok, entendi
                      </button>
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono font-medium">{reais(precoUnitario * item.quantidade)}</p>
                  {item.quantidade > 1 && (
                    <p className="text-[11px] text-ink/40 font-mono">
                      {reais(precoUnitario)} cada
                    </p>
                  )}
                </div>
              </div>
              <div className="flex justify-end mt-3">
                <button
                  onClick={() => removerItem(item.id)}
                  className="text-xs text-berry hover:underline"
                  aria-label={`Remover ${produto.nome} do carrinho`}
                >
                  Remover
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white border border-line rounded-lg p-5 mb-5">
        <div className="flex justify-between font-medium">
          <span>Subtotal</span>
          <span className="font-mono">{reais(subtotal)}</span>
        </div>
        <p className="text-xs text-ink/40 mt-1.5">Frete e cupom são calculados no checkout.</p>
      </div>

      {indisponiveis.length > 0 && (
        <p className="text-sm text-berry mb-4">
          Remova os itens indisponíveis pra continuar.
        </p>
      )}
      {bloqueadas.length > 0 && indisponiveis.length === 0 && (
        <p className="text-sm text-berry mb-4">
          Ajuste ou remova os itens sem estoque suficiente pra continuar.
        </p>
      )}
      {semArte.length > 0 && indisponiveis.length === 0 && (
        <p className="text-sm text-berry mb-4">
          Falta definir a arte de {semArte.length === 1 ? "1 item" : `${semArte.length} itens`}{" "}
          antes de pagar.
        </p>
      )}

      <button
        onClick={() => router.push("/checkout")}
        disabled={!podeFinalizar}
        className="w-full bg-berry text-paper font-medium px-8 py-3.5 rounded-full disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-95 transition mb-3"
      >
        Finalizar compra
      </button>
      <Link href="/" className="block text-center text-sm text-pine-2 hover:underline">
        Continuar comprando
      </Link>

      <div className="mt-10">
        <SugestoesCarrinho />
        <SalvarCarrinhoPorEmail />
      </div>
    </div>
  );
}
