"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useProdutos } from "@/lib/use-produtos";
import { useCart, type ItemCarrinho } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";
import { useConta } from "@/lib/conta-context";
import { useCep } from "@/lib/use-cep";
import { compararPreco } from "@/lib/compare-price";
import { formatarCep, normalizarCep } from "@/lib/frete";
import { precoEfetivo } from "@/lib/estoque-variacao";
import EnderecoForm from "@/components/EnderecoForm";
import QuantidadeItem from "@/components/QuantidadeItem";
import { novoIdEndereco, type Endereco } from "@/lib/conta-data";
import type { Produto } from "@/lib/types";

function reais(valor: number) {
  return `R$ ${valor.toFixed(2).replace(".", ",")}`;
}

const enderecoVazio: Endereco = {
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
  const { itens, definirQuantidade, removerItem } = useCart();
  const { logado, carregando: carregandoAuth } = useAuth();
  const { enderecos, salvarEndereco, carregando: carregandoConta } = useConta();
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState(erroInicial);

  const { produtos, carregando } = useProdutos(itens.map((i) => i.produtoId));

  // Endereço escolhido pra entrega — obrigatório pra fechar o pedido. `null`
  // até o cliente escolher; a pré-seleção abaixo roda uma vez, assim que a
  // lista carrega (padrão, ou o que casa com o CEP digitado na página do
  // produto), mas nunca decide por conta própria depois disso. Ajuste de
  // estado durante o render (não efeito) — mesmo padrão do `logadoAnterior`
  // em conta-context.tsx.
  // CEP que o cliente digitou na página de produto (o da adição mais recente).
  const cepInformado = itens.findLast((i) => i.cepInformado)?.cepInformado;
  const [enderecoIdSelecionado, setEnderecoIdSelecionado] = useState<string | null>(null);
  const [enderecoJaPreSelecionado, setEnderecoJaPreSelecionado] = useState(false);
  // Formulário de novo endereço aberto inline, embutido no checkout — sem
  // isso, quem não tem endereço nenhum ficaria travado sem forma de
  // continuar (ver EnderecoForm).
  const [mostrandoFormNovo, setMostrandoFormNovo] = useState(false);
  if (!enderecoJaPreSelecionado && enderecos.length > 0) {
    setEnderecoJaPreSelecionado(true);
    const cepDoProduto = cepInformado ? normalizarCep(cepInformado) : null;
    const porCep = cepDoProduto
      ? enderecos.find((e) => normalizarCep(e.cep) === cepDoProduto)
      : undefined;
    const padrao = enderecos.find((e) => e.padrao);
    setEnderecoIdSelecionado((porCep ?? padrao ?? enderecos[0])?.id ?? null);
  }

  const enderecoSelecionado = enderecos.find((e) => e.id === enderecoIdSelecionado) ?? null;
  // Sem endereço nenhum cadastrado (e já sabemos disso, não só ainda
  // carregando), o formulário de cadastro abre sozinho — senão o cliente
  // fica sem nenhuma forma de continuar o checkout.
  const formularioAberto =
    mostrandoFormNovo || (!carregandoConta && enderecos.length === 0);
  const cepSelecionado = enderecoSelecionado ? normalizarCep(enderecoSelecionado.cep) : null;

  // O frete é cotado sobre o carrinho inteiro (uma cotação por CEP de origem,
  // somadas — ver consultarCep no servidor).
  const linhasFrete = useMemo(
    () =>
      itens.map((i) => ({
        produtoId: i.produtoId,
        quantidade: i.quantidade,
        variacoes: i.variacoesEscolhidas,
      })),
    [itens]
  );
  const { endereco, erro: erroCep, consultando: consultandoCep } = useCep(
    cepSelecionado ? formatarCep(cepSelecionado) : "",
    linhasFrete
  );

  // EnderecoForm já trata o erro (mostra a própria mensagem) se `onSalvar`
  // rejeitar — aqui só reage ao sucesso, selecionando o endereço recém-criado.
  async function salvarNovoEndereco(dados: Endereco) {
    await salvarEndereco(dados);
    setEnderecoIdSelecionado(dados.id);
    setMostrandoFormNovo(false);
  }

  const [codigoCupom, setCodigoCupom] = useState("");
  // Serviço de frete escolhido no checkout (ex: "PAC", "SEDEX") — só existe
  // rádio quando `opcoesFrete` tem mais de um item (SuperFrete com várias
  // opções). Guarda o CEP junto: é estado derivado, igual ao padrão de
  // `recalculandoCupom` abaixo — se o CEP mudou, a escolha antiga não vale
  // mais e cai de volta pra "mais barata" sem precisar de um efeito.
  const [servicoEscolhidoState, setServicoEscolhidoState] = useState<{
    cep: string;
    servico: string;
  } | null>(null);
  const servicoEscolhido =
    servicoEscolhidoState?.cep === endereco?.cep ? (servicoEscolhidoState?.servico ?? null) : null;
  // `chave` guarda sobre qual carrinho (produtos e valores das linhas) esse
  // desconto foi calculado. Mudar uma quantidade muda o valor, e um desconto
  // percentual sobre o total antigo mostraria na tela um total que o servidor
  // não vai cobrar.
  const [cupomAplicado, setCupomAplicado] = useState<{
    codigo: string;
    desconto: number;
    freteGratis: boolean;
    chave: string;
  } | null>(null);
  const [validandoCupom, setValidandoCupom] = useState(false);
  const [erroCupom, setErroCupom] = useState("");

  // Preço final de cada linha considerando a variação escolhida (ex: "Tamanho
  // imã": 7x7 = R$1) já multiplicado pela quantidade — é o valor que o cupom
  // valida e que compõe o subtotal exibido. Linha sem produto carregado (ou
  // que saiu do catálogo) não tem preço e fica fora da conta.
  const linhasCupom = useMemo(
    () =>
      itens.flatMap((i) => {
        const p = produtos[i.produtoId];
        return p
          ? [{ produtoId: i.produtoId, valor: precoEfetivo(p, i.variacoesEscolhidas) * i.quantidade }]
          : [];
      }),
    [itens, produtos]
  );
  const precoProdutos = linhasCupom.reduce((soma, l) => soma + l.valor, 0);
  const chaveCupom = JSON.stringify(linhasCupom);

  // Cupom validado sobre um carrinho que não é mais o da tela: o desconto em
  // mãos está velho até a revalidação abaixo responder. É estado derivado — dá
  // pra ler direto de `cupomAplicado`, sem um `useState` pra espelhar.
  const recalculandoCupom = !!cupomAplicado && cupomAplicado.chave !== chaveCupom;

  // O pedido é gravado no banco em nome do usuário, então quem tem sacola mas
  // não tem sessão passa pelo login antes de ver o resumo.
  useEffect(() => {
    if (!carregandoAuth && !logado && itens.length > 0) {
      router.replace("/entrar?next=/checkout");
    }
  }, [carregandoAuth, logado, itens.length, router]);

  // Carrinho mudou com cupom aplicado: revalida no servidor pelos novos valores
  // em vez de repetir o desconto antigo. Se o cupom não valer mais pra esse
  // carrinho (pedido mínimo, por exemplo), ele sai da tela com o motivo —
  // melhor aqui do que só na hora de pagar, quando o servidor recalcula tudo.
  useEffect(() => {
    if (!cupomAplicado || cupomAplicado.chave === chaveCupom) return;

    const { codigo } = cupomAplicado;
    let cancelado = false;

    fetch("/api/cupons/validar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo, valorPedido: precoProdutos, itens: linhasCupom }),
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
          chave: chaveCupom,
        });
      })
      .catch(() => {
        if (cancelado) return;
        setErroCupom("Não foi possível recalcular o cupom agora.");
        setCupomAplicado(null);
      });

    // Mexer no carrinho de novo no meio da consulta descarta a resposta
    // antiga, que já nasceu de um valor que não é mais o da tela.
    return () => {
      cancelado = true;
    };
  }, [cupomAplicado, chaveCupom, precoProdutos, linhasCupom]);

  if (carregando) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center">
        <p className="text-ink/60">Carregando...</p>
      </div>
    );
  }

  // Sem nada no carrinho não há o que fechar.
  if (itens.length === 0) {
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

  // Linha cujo produto saiu do catálogo não tem o que fechar: aparece com o
  // aviso e trava o pagamento até ser removida.
  const linhas = itens.map((item) => ({ item, produto: produtos[item.produtoId] }));
  const indisponiveis = linhas.filter((l) => !l.produto);
  const disponiveis = linhas.filter(
    (l): l is { item: ItemCarrinho; produto: Produto } => !!l.produto
  );

  const semArte = disponiveis.filter(
    (l) => l.produto.requerPersonalizacao && !l.item.personalizacao?.aceite
  );
  const precisaArte = semArte.length > 0;
  const totalUnidades = itens.reduce((soma, i) => soma + i.quantidade, 0);
  // Produção extra de personalização soma ao prazo: vale a linha mais demorada.
  const diasProducaoExtra = Math.max(0, ...disponiveis.map((l) => l.produto.diasProducaoExtra));

  // Comparativo com a Shopee: soma só as linhas que têm economia pra mostrar.
  const comparativo = disponiveis.reduce(
    (acc, { item, produto }) => {
      const precoUnitario = precoEfetivo(produto, item.variacoesEscolhidas);
      const c = compararPreco(produto.precoShopee, precoUnitario, produto.vendidoNaShopee);
      if (!c.mostrar) return acc;
      return {
        shopee: acc.shopee + produto.precoShopee * item.quantidade,
        site: acc.site + precoUnitario * item.quantidade,
        economia: acc.economia + c.economia * item.quantidade,
      };
    },
    { shopee: 0, site: 0, economia: 0 }
  );
  const mostrarComparativo = comparativo.economia > 0;
  const percentualEconomia = mostrarComparativo
    ? Math.round((comparativo.economia / comparativo.shopee) * 100)
    : 0;

  const opcoesFrete = endereco?.opcoesFrete ?? [];
  const freteCalculado =
    opcoesFrete.find((o) => o.servico === servicoEscolhido) ?? opcoesFrete[0] ?? null;
  const desconto = cupomAplicado?.desconto ?? 0;
  const subtotal = Math.max(0, precoProdutos - desconto);

  // Frete grátis por cupom OU por o pedido já bater o valor mínimo
  // configurado em /admin/cupons — os dois só zeram o frete cobrado, nunca
  // empilham desconto duplicado.
  const freteGratisPorValor = freteGratisAcimaDe !== null && precoProdutos >= freteGratisAcimaDe;
  const freteGratis = !!cupomAplicado?.freteGratis || freteGratisPorValor;
  const frete = freteGratis ? 0 : (freteCalculado?.valor ?? null);
  const total = subtotal + (frete ?? 0);

  function aplicarCupom() {
    if (!codigoCupom.trim()) return;
    setErroCupom("");
    setValidandoCupom(true);

    // Carrinho congelado aqui: se algo mudar antes da resposta chegar, o
    // efeito de revalidação vê a diferença e pede o desconto de novo.
    const chave = chaveCupom;

    fetch("/api/cupons/validar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        codigo: codigoCupom,
        valorPedido: precoProdutos,
        itens: linhasCupom,
      }),
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
          chave,
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
    // O botão já fica travado sem itens, endereço e frete; a checagem sobra
    // só pra estreitar os tipos.
    if (itens.length === 0 || !endereco || !enderecoIdSelecionado) return;
    setErro("");
    setProcessando(true);

    fetch("/api/pedidos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Frete e desconto não vão fixos no corpo, de propósito: o servidor
      // recalcula os dois a partir do endereço e do código do cupom.
      body: JSON.stringify({
        itens,
        enderecoId: enderecoIdSelecionado,
        cupomCodigo: cupomAplicado?.codigo,
        servicoFrete: freteCalculado?.servico,
      }),
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          setErro(data.error ?? "Não foi possível concluir o pedido.");
          setProcessando(false);
          return;
        }
        // O carrinho só é limpo quando o pagamento é confirmado (ver
        // /pedido/confirmado): se o cliente voltar de um pagamento recusado,
        // os itens continuam aqui em vez de ter que ser montados de novo.
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

      <div className="space-y-3 mb-5">
        {linhas.map(({ item, produto }) => {
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
          return (
            <div key={item.id} className="bg-white border border-line rounded-lg p-5">
              <div className="flex gap-4">
                <div
                  className="w-16 h-16 rounded-md flex items-center justify-center text-2xl shrink-0 overflow-hidden"
                  style={{ backgroundColor: `${produto.cor}22` }}
                >
                  {produto.imagens[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={produto.imagens[0]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    produto.emoji
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{produto.nome}</p>
                  <p className="text-xs text-ink/50">
                    {Object.entries(item.variacoesEscolhidas)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(" · ")}
                  </p>
                  {item.personalizacao && (
                    <p className="text-xs text-pine-2 mt-1">✓ {item.personalizacao.resumo}</p>
                  )}
                  {/* Personalização é feita uma vez por unidade; item que já
                      exige arte fica travado em 1 (o seletor nem aparece). */}
                  <QuantidadeItem
                    produto={produto}
                    variacoesEscolhidas={item.variacoesEscolhidas}
                    quantidade={item.quantidade}
                    onChange={(q) => definirQuantidade(item.id, q)}
                  />
                </div>
                <p className="font-mono font-medium">{reais(precoUnitario * item.quantidade)}</p>
              </div>
              {itens.length > 1 && (
                <div className="flex justify-end mt-3">
                  <button
                    onClick={() => removerItem(item.id)}
                    className="text-xs text-berry hover:underline"
                    aria-label={`Remover ${produto.nome} do pedido`}
                  >
                    Remover
                  </button>
                </div>
              )}
            </div>
          );
        })}
        <Link href="/carrinho" className="block text-center text-xs text-pine-2 hover:underline">
          Voltar ao carrinho
        </Link>
      </div>

      {precisaArte && (
        <div className="bg-berry/10 border border-berry/40 text-berry text-sm rounded-md px-4 py-3 mb-5">
          Falta definir e confirmar a arte antes de pagar.{" "}
          <button
            onClick={() => router.push(`/personalizar/${semArte[0].produto.id}`)}
            className="underline font-medium"
          >
            Voltar pra personalização
          </button>
        </div>
      )}

      {indisponiveis.length > 0 && (
        <div className="bg-berry/10 border border-berry/40 text-berry text-sm rounded-md px-4 py-3 mb-5">
          Remova os itens indisponíveis pra poder pagar.
        </div>
      )}

      <div className="bg-white border border-line rounded-lg p-5 mb-5">
        <p className="text-sm font-medium mb-3">Entrega</p>

        {enderecos.length > 0 && !formularioAberto && (
          <div className="space-y-1.5 mb-1">
            {enderecos.map((e) => (
              <label
                key={e.id}
                className="flex items-start justify-between gap-3 border border-line rounded-md px-3 py-2.5 cursor-pointer has-[:checked]:border-pine has-[:checked]:bg-pine/5"
              >
                <span className="flex items-start gap-2.5">
                  <input
                    type="radio"
                    name="enderecoEntrega"
                    checked={enderecoIdSelecionado === e.id}
                    onChange={() => setEnderecoIdSelecionado(e.id)}
                    className="accent-pine mt-1"
                  />
                  <span className="text-sm">
                    <span className="font-medium">
                      {e.rotulo}
                      {e.padrao && (
                        <span className="ml-1.5 text-[10px] bg-pine/10 text-pine-2 px-1.5 py-0.5 rounded-full">
                          Padrão
                        </span>
                      )}
                    </span>
                    <p className="text-ink/60 text-xs mt-0.5">
                      {e.destinatario} — {e.rua}, {e.numero}
                      {e.complemento ? `, ${e.complemento}` : ""}
                    </p>
                    <p className="text-ink/60 text-xs">
                      {e.bairro} — {e.cidade}/{e.uf} — {formatarCep(e.cep)}
                    </p>
                  </span>
                </span>
                {/* Corrigir um endereço já salvo (número errado, complemento
                    faltando) sem precisar excluir e recadastrar do zero — a
                    única forma de editar até aqui era via /conta/enderecos,
                    perdendo o checkout em andamento. `next` traz de volta. */}
                <Link
                  href={`/conta/enderecos/${e.id}?next=/checkout`}
                  onClick={(ev) => ev.stopPropagation()}
                  className="text-xs text-pine font-medium shrink-0"
                >
                  Editar
                </Link>
              </label>
            ))}

            <button
              onClick={() => setMostrandoFormNovo(true)}
              className="w-full text-left border border-dashed border-line rounded-md px-3 py-2.5 text-sm text-pine-2"
            >
              + Adicionar novo endereço
            </button>
          </div>
        )}

        {formularioAberto && (
          <div className={enderecos.length > 0 ? "border-t border-line mt-3 pt-4" : ""}>
            <EnderecoForm
              inicial={{
                ...enderecoVazio,
                id: novoIdEndereco(),
                cep: cepInformado ? formatarCep(cepInformado) : "",
              }}
              onSalvar={salvarNovoEndereco}
            />
            {enderecos.length > 0 && (
              <button
                onClick={() => setMostrandoFormNovo(false)}
                className="w-full text-center text-xs text-ink/50 py-2"
              >
                Cancelar
              </button>
            )}
          </div>
        )}

        {consultandoCep && <p className="text-xs text-ink/50 mt-2">Calculando frete...</p>}
        {erroCep && <p className="text-xs text-berry mt-2">{erroCep}</p>}

        {endereco && !formularioAberto && (
          <div className="mt-3 text-sm">
            {opcoesFrete.length > 1 ? (
              // Mais de uma opção (SuperFrete com PAC/SEDEX, por exemplo): o
              // cliente escolhe qual serviço usar, em vez de já vir travado
              // na mais barata.
              <div className="mt-2.5 space-y-1.5">
                {opcoesFrete.map((opcao) => (
                  <label
                    key={opcao.servico}
                    className="flex items-center justify-between gap-3 border border-line rounded-md px-3 py-2 cursor-pointer has-[:checked]:border-pine has-[:checked]:bg-pine/5"
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="servicoFrete"
                        checked={freteCalculado?.servico === opcao.servico}
                        onChange={() =>
                          endereco &&
                          setServicoEscolhidoState({ cep: endereco.cep, servico: opcao.servico })
                        }
                        className="accent-pine"
                      />
                      <span className="text-xs">
                        <span className="font-medium">{opcao.servico}</span>{" "}
                        <span className="text-ink/50">
                          — até {opcao.prazoDias + diasProducaoExtra} dias úteis
                        </span>
                      </span>
                    </span>
                    <span className="text-xs font-mono shrink-0">{reais(opcao.valor)}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-xs text-pine-2 mt-1.5">
                Entrega em até {(freteCalculado?.prazoDias ?? 0) + diasProducaoExtra} dias úteis
                após a postagem
              </p>
            )}
          </div>
        )}

        <p className="text-xs text-ink/40 mt-3">
          Estimativa por região — o valor final da postagem pode variar.
        </p>
      </div>

      {mostrarComparativo && (
        <div className="bg-white border border-line rounded-lg p-5 mb-5">
          <p className="text-sm font-medium mb-3">Comparativo de preço</p>
          <div className="flex justify-between text-sm mb-1.5">
            <span className="text-ink/60">Na Shopee</span>
            <span className="line-through text-ink/40 font-mono">{reais(comparativo.shopee)}</span>
          </div>
          <div className="flex justify-between text-sm font-medium mb-1.5">
            <span>Aqui no site</span>
            <span className="font-mono text-pine-2">{reais(comparativo.site)}</span>
          </div>
          <div className="flex justify-between text-sm text-berry">
            <span>Você economiza</span>
            <span className="font-mono">
              {reais(comparativo.economia)} ({percentualEconomia}%)
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
            {itens.length > 1 ? "Produtos" : "Produto"}
            {totalUnidades > 1 ? ` (${totalUnidades}x)` : ""}
          </span>
          <span className="font-mono">{reais(precoProdutos)}</span>
        </div>
        {(desconto > 0 || recalculandoCupom) && (
          <div className="flex justify-between text-sm mb-1.5">
            <span className="text-ink/60">Desconto ({cupomAplicado?.codigo})</span>
            <span className="font-mono text-pine-2">
              {/* Enquanto a revalidação não volta, o desconto em mãos foi
                  calculado sobre outro carrinho — mostrar o número velho
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
        disabled={
          precisaArte ||
          indisponiveis.length > 0 ||
          processando ||
          !enderecoIdSelecionado ||
          !freteCalculado ||
          recalculandoCupom
        }
        className="w-full bg-berry text-paper font-medium px-8 py-3.5 rounded-full disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-95 transition"
      >
        {processando
          ? "Processando pagamento..."
          : recalculandoCupom
            ? "Recalculando o desconto..."
            : !enderecoIdSelecionado
              ? "Escolha um endereço pra continuar"
              : `Pagar ${reais(total)}`}
      </button>
    </div>
  );
}
