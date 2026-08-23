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
  freteGratisAcimaDe = null,
}: {
  pagamentoReal: boolean;
  erroInicial?: string;
  freteGratisAcimaDe?: number | null;
}) {
  const router = useRouter();
  const { item, definirQuantidade } = useCart();
  const { logado, carregando: carregandoAuth } = useAuth();
  const { enderecos } = useConta();
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState(erroInicial);

  const { produto, carregando } = useProduto(item?.produtoId);

  // Quem já tem endereço padrão salvo começa com ele preenchido; digitar por
  // cima assume o controle do campo (`null` = ainda não mexeu). O CEP
  // informado na própria página do produto tem prioridade sobre o endereço
  // salvo — é a escolha mais recente do cliente.
  const enderecoPadrao = enderecos.find((e) => e.padrao) ?? enderecos[0];
  const cepPadrao = enderecoPadrao ? normalizarCep(enderecoPadrao.cep) : null;
  const cepInicial = item?.cepInformado ? normalizarCep(item.cepInformado) : cepPadrao;
  const [cepDigitado, setCepDigitado] = useState<string | null>(null);
  const cep = cepDigitado ?? (cepInicial ? formatarCep(cepInicial) : "");

  const quantidade = item?.quantidade ?? 1;
  const quantidadeMinima = Math.max(1, produto?.quantidadeMinima || 1);
  const { endereco, erro: erroCep, consultando: consultandoCep } = useCep(
    cep,
    item?.produtoId,
    quantidade
  );

  const [codigoCupom, setCodigoCupom] = useState("");
  // `valorPedido` guarda sobre qual valor esse desconto foi calculado. Mudar a
  // quantidade muda o valor, e um desconto percentual sobre o total antigo
  // mostraria na tela um total que o servidor não vai cobrar.
  const [cupomAplicado, setCupomAplicado] = useState<{
    codigo: string;
    desconto: number;
    freteGratis: boolean;
    valorPedido: number;
  } | null>(null);
  const [validandoCupom, setValidandoCupom] = useState(false);
  const [erroCupom, setErroCupom] = useState("");

  // Preço já multiplicado pela quantidade — é o valor que o cupom valida e
  // que compõe o subtotal exibido. Sem produto carregado ainda não há preço,
  // e o efeito abaixo não tem o que revalidar.
  const precoProduto = (produto?.preco ?? 0) * quantidade;

  // Cupom validado sobre um valor que não é mais o da tela: o desconto em mãos
  // está velho até a revalidação abaixo responder. É estado derivado — dá pra
  // ler direto de `cupomAplicado`, sem um `useState` pra espelhar.
  const recalculandoCupom = !!cupomAplicado && cupomAplicado.valorPedido !== precoProduto;

  // O pedido é gravado no banco em nome do usuário, então quem tem sacola mas
  // não tem sessão passa pelo login antes de ver o resumo.
  useEffect(() => {
    if (!carregandoAuth && !logado && item) {
      router.replace("/entrar?next=/checkout");
    }
  }, [carregandoAuth, logado, item, router]);

  // Quantidade mudou com cupom aplicado: revalida no servidor pelo novo valor
  // em vez de repetir o desconto antigo. Se o cupom não valer mais pra esse
  // valor (pedido mínimo, por exemplo), ele sai da tela com o motivo — melhor
  // aqui do que só na hora de pagar, quando o servidor recalcula tudo.
  useEffect(() => {
    if (!cupomAplicado || cupomAplicado.valorPedido === precoProduto) return;

    const { codigo } = cupomAplicado;
    let cancelado = false;

    fetch("/api/cupons/validar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo, valorPedido: precoProduto }),
    })
      .then(async (r) => {
        const data = await r.json();
        if (cancelado) return;
        if (!r.ok) {
          setErroCupom(data.error ?? "O cupom não vale mais para esse pedido.");
          setCupomAplicado(null);
          return;
        }
        setErroCupom("");
        setCupomAplicado({
          codigo,
          desconto: data.desconto,
          freteGratis: !!data.freteGratis,
          valorPedido: precoProduto,
        });
      })
      .catch(() => {
        if (cancelado) return;
        setErroCupom("Não foi possível recalcular o cupom agora.");
        setCupomAplicado(null);
      });

    // Trocar a quantidade de novo no meio da consulta descarta a resposta
    // antiga, que já nasceu de um valor que não é mais o da tela.
    return () => {
      cancelado = true;
    };
  }, [cupomAplicado, precoProduto]);

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
  const comparacao = compararPreco(produto.precoShopee, produto.preco, produto.vendidoNaShopee);
  const freteCalculado = endereco?.frete ?? null;
  const desconto = cupomAplicado?.desconto ?? 0;
  const subtotal = Math.max(0, precoProduto - desconto);

  // Frete grátis por cupom OU por o pedido já bater o valor mínimo
  // configurado em /admin/cupons — os dois só zeram o frete cobrado, nunca
  // empilham desconto duplicado.
  const freteGratisPorValor = freteGratisAcimaDe !== null && precoProduto >= freteGratisAcimaDe;
  const freteGratis = !!cupomAplicado?.freteGratis || freteGratisPorValor;
  const frete = freteGratis ? 0 : (freteCalculado?.valor ?? null);
  const total = subtotal + (frete ?? 0);

  function aplicarCupom() {
    if (!codigoCupom.trim()) return;
    setErroCupom("");
    setValidandoCupom(true);

    // Valor congelado aqui: se a quantidade mudar antes da resposta chegar, o
    // efeito de revalidação vê a diferença e pede o desconto de novo.
    const valorPedido = precoProduto;

    fetch("/api/cupons/validar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo: codigoCupom, valorPedido }),
      // (valorPedido já é preço unitário × quantidade)
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          setErroCupom(data.error ?? "Não foi possível aplicar o cupom.");
          setCupomAplicado(null);
          return;
        }
        setCupomAplicado({
          codigo: codigoCupom.trim().toUpperCase(),
          desconto: data.desconto,
          freteGratis: !!data.freteGratis,
          valorPedido,
        });
      })
      .catch(() => setErroCupom("Não foi possível aplicar o cupom agora."))
      .finally(() => setValidandoCupom(false));
  }

  function removerCupom() {
    setCupomAplicado(null);
    setCodigoCupom("");
    setErroCupom("");
  }

  function pagar() {
    // O botão já fica travado sem item e sem frete; a checagem sobra só pra
    // estreitar os tipos.
    if (!item || !endereco) return;
    setErro("");
    setProcessando(true);

    fetch("/api/pedidos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Frete e desconto não vão fixos no corpo, de propósito: o servidor
      // recalcula os dois a partir do CEP e do código do cupom.
      body: JSON.stringify({
        item,
        cep: normalizarCep(cep),
        cupomCodigo: cupomAplicado?.codigo,
      }),
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          setErro(data.error ?? "Não foi possível concluir o pedido.");
          setProcessando(false);
          return;
        }
        // A sacola só é limpa quando o pagamento é confirmado (ver
        // /pedido/confirmado): se o cliente voltar de um pagamento recusado,
        // o item continua aqui em vez de ter que ser montado de novo.
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

            {/* Personalização é feita uma vez por unidade; item que já exige
                arte fica travado em 1 pra não pedir n artes diferentes aqui. */}
            {!produto.requerPersonalizacao && (
              <div className="flex items-center gap-3 mt-2">
                <span className="text-xs text-ink/50">Quantidade</span>
                {produto.quantidadePersonalizavel ? (
                  <input
                    type="number"
                    inputMode="numeric"
                    min={quantidadeMinima}
                    value={quantidade}
                    onChange={(e) => {
                      const valor = Math.round(Number(e.target.value));
                      definirQuantidade(Number.isFinite(valor) && valor > 0 ? valor : quantidadeMinima);
                    }}
                    onBlur={() => definirQuantidade(Math.max(quantidadeMinima, quantidade))}
                    className="w-16 h-7 border border-line rounded-full text-center text-sm font-mono"
                  />
                ) : (
                  <div className="flex items-center border border-line rounded-full">
                    <button
                      onClick={() => definirQuantidade(quantidade - 1)}
                      disabled={quantidade <= quantidadeMinima}
                      className="w-7 h-7 flex items-center justify-center text-sm disabled:opacity-30"
                      aria-label="Diminuir quantidade"
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-sm font-mono">{quantidade}</span>
                    <button
                      onClick={() => definirQuantidade(quantidade + 1)}
                      className="w-7 h-7 flex items-center justify-center text-sm"
                      aria-label="Aumentar quantidade"
                    >
                      +
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          <p className="font-mono font-medium">{reais(precoProduto)}</p>
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
              Entrega em até{" "}
              {endereco.frete.prazoDias + produto.diasProducaoExtra}{" "}
              dias úteis após a postagem
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
        <p className="text-sm font-medium mb-3">Cupom de desconto</p>
        {cupomAplicado ? (
          <div className="flex items-center justify-between bg-pine/5 border border-pine/30 rounded-md px-4 py-2.5">
            <p className="text-sm text-pine-2">
              <span className="font-mono font-medium">{cupomAplicado.codigo}</span> aplicado —{" "}
              {recalculandoCupom
                ? "recalculando..."
                : cupomAplicado.freteGratis
                  ? "frete grátis"
                  : `${reais(cupomAplicado.desconto)} de desconto`}
            </p>
            <button onClick={removerCupom} className="text-xs text-berry hover:underline shrink-0">
              Remover
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              value={codigoCupom}
              onChange={(e) => setCodigoCupom(e.target.value.toUpperCase())}
              placeholder="Código do cupom"
              className="flex-1 bg-white border border-line rounded-lg px-4 py-2.5 text-sm font-mono outline-none focus:border-pine"
            />
            <button
              onClick={aplicarCupom}
              disabled={validandoCupom || !codigoCupom.trim()}
              className="bg-pine/10 text-pine-2 font-medium px-5 py-2.5 rounded-lg text-sm disabled:opacity-40 hover:bg-pine/15 transition"
            >
              {validandoCupom ? "..." : "Aplicar"}
            </button>
          </div>
        )}
        {erroCupom && <p className="text-xs text-berry mt-2">{erroCupom}</p>}
      </div>

      <div className="bg-white border border-line rounded-lg p-5 mb-5">
        <div className="flex justify-between text-sm mb-1.5">
          <span className="text-ink/60">
            Produto{quantidade > 1 ? ` (${quantidade}x)` : ""}
          </span>
          <span className="font-mono">{reais(precoProduto)}</span>
        </div>
        {(desconto > 0 || recalculandoCupom) && (
          <div className="flex justify-between text-sm mb-1.5">
            <span className="text-ink/60">Desconto ({cupomAplicado?.codigo})</span>
            <span className="font-mono text-pine-2">
              {/* Enquanto a revalidação não volta, o desconto em mãos foi
                  calculado sobre outra quantidade — mostrar o número velho
                  aqui é justamente o "total mentiroso" que isto resolve. */}
              {recalculandoCupom ? "recalculando..." : `-${reais(desconto)}`}
            </span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-ink/60">Frete</span>
          <span className="font-mono">
            {!freteCalculado ? (
              <span className="text-ink/40">informe o CEP</span>
            ) : freteGratis ? (
              <span className="text-pine-2">
                <span className="line-through text-ink/30 mr-1.5">{reais(freteCalculado.valor)}</span>
                Grátis
              </span>
            ) : (
              reais(freteCalculado.valor)
            )}
          </span>
        </div>
        <div className="flex justify-between font-medium pt-3 mt-3 border-t border-line">
          <span>Total</span>
          <span className="font-mono">{recalculandoCupom ? "—" : reais(total)}</span>
        </div>
      </div>

      <div className="bg-white border border-line rounded-lg p-5 mb-8">
        <p className="text-sm font-medium mb-3">Pagamento</p>
        <p className="text-xs text-ink/40">
          {pagamentoReal
            ? "Você escolhe a forma de pagamento na próxima tela, no ambiente seguro do Mercado Pago."
            : "Simulação — nenhum pagamento real é processado sem as credenciais do Mercado Pago."}
        </p>
      </div>

      {erro && <p className="text-sm text-berry mb-4">{erro}</p>}

      {/* Pagar com o desconto sendo recalculado cobraria um total que a tela
          ainda não mostra — o botão espera a conta fechar. */}
      <button
        onClick={pagar}
        disabled={precisaArte || processando || !freteCalculado || recalculandoCupom}
        className="w-full bg-berry text-paper font-medium px-8 py-3.5 rounded-full disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-95 transition"
      >
        {processando
          ? "Processando pagamento..."
          : recalculandoCupom
            ? "Recalculando o desconto..."
            : `Pagar ${reais(total)}`}
      </button>
    </div>
  );
}
