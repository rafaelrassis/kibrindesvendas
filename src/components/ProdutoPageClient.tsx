"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useProduto } from "@/lib/use-produto";
import { useCart } from "@/lib/cart-context";
import { useConta } from "@/lib/conta-context";
import { useCep } from "@/lib/use-cep";
import { compararPreco } from "@/lib/compare-price";
import { formatarCep, normalizarCep } from "@/lib/frete";
import FavoritoButton from "@/components/FavoritoButton";
import AvaliacoesProduto from "@/components/AvaliacoesProduto";
import Lightbox from "@/components/Lightbox";

function reais(valor: number) {
  return `R$ ${valor.toFixed(2).replace(".", ",")}`;
}

export default function ProdutoPageClient() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { produto, carregando } = useProduto(id);
  const { iniciarItem } = useCart();
  const { enderecos } = useConta();

  const [selecoes, setSelecoes] = useState<Record<string, string>>({});

  // Quem já tem endereço salvo começa com o CEP dele preenchido; digitar por
  // cima assume o controle do campo (`null` = ainda não mexeu).
  const enderecoPadrao = enderecos.find((e) => e.padrao) ?? enderecos[0];
  const cepPadrao = enderecoPadrao ? normalizarCep(enderecoPadrao.cep) : null;
  const [cepDigitado, setCepDigitado] = useState<string | null>(null);
  const cep = cepDigitado ?? (cepPadrao ? formatarCep(cepPadrao) : "");
  const { endereco, erro: erroCep, consultando: consultandoCep } = useCep(cep, id);

  // Começa fechado (mostra só o resumo) enquanto houver um endereço resolvido
  // — o CEP padrão da conta só chega depois da hidratação, então isso é
  // derivado do estado atual em vez de fixado na montagem; "alterar" força o
  // campo a reaparecer pra digitar de novo.
  const [alterandoCep, setAlterandoCep] = useState(false);
  const mostrarInputCep = alterandoCep || !endereco;

  // A barra fixa no topo some enquanto o bloco de preço original está visível
  // e aparece assim que ele sai da tela rolando pra cima — como no Magalu.
  const precoRef = useRef<HTMLDivElement>(null);
  const [mostrarBarraFixa, setMostrarBarraFixa] = useState(false);
  useEffect(() => {
    const alvo = precoRef.current;
    if (!alvo) return;
    const observer = new IntersectionObserver(
      ([entrada]) =>
        setMostrarBarraFixa(!entrada.isIntersecting && entrada.boundingClientRect.top < 0),
      { threshold: 0 }
    );
    observer.observe(alvo);
    return () => observer.disconnect();
  }, [produto?.id]);

  // A barra fixa se posiciona logo abaixo do header medindo a altura dele em
  // vez de usar um valor fixo — o header muda de altura entre mobile e desktop.
  const [offsetHeader, setOffsetHeader] = useState(0);
  useEffect(() => {
    const header = document.querySelector("header");
    if (!header) return;
    const medir = () => setOffsetHeader(header.getBoundingClientRect().height);
    medir();
    const observer = new ResizeObserver(medir);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  if (carregando) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-16 text-center">
        <p className="text-ink/60">Carregando...</p>
      </div>
    );
  }

  if (!produto) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-16 text-center">
        <p className="text-ink/60">Produto não encontrado.</p>
      </div>
    );
  }

  const comparacao = compararPreco(produto.precoShopee, produto.preco, produto.vendidoNaShopee);
  const esgotado = produto.estoque === 0;
  const estoqueBaixo = produto.estoque !== null && produto.estoque > 0 && produto.estoque <= 5;
  const faltaEscolher = produto.variacoes.some((v) => !selecoes[v.tipo]) || esgotado;

  // Personalização não tem como pular pro pagamento sem antes definir a arte
  // — por isso só existe um botão nesse caso, sem a escolha "sacola vs. agora".
  function avancarPersonalizacao() {
    if (!produto || faltaEscolher) return;
    iniciarItem(produto.id, selecoes, normalizarCep(cep) ?? undefined);
    router.push(`/personalizar/${produto.id}`);
  }

  // Guarda o item e volta pra loja — pra quem quer continuar navegando antes
  // de fechar a compra.
  function adicionarASacola() {
    if (!produto || faltaEscolher) return;
    iniciarItem(produto.id, selecoes, normalizarCep(cep) ?? undefined);
    router.push("/");
  }

  // Guarda o item e já manda direto pro checkout — o CEP calculado aqui segue
  // junto, o checkout começa com ele preenchido em vez de pedir de novo.
  function comprarAgora() {
    if (!produto || faltaEscolher) return;
    iniciarItem(produto.id, selecoes, normalizarCep(cep) ?? undefined);
    router.push("/checkout");
  }

  const resumoEndereco = endereco
    ? `${endereco.logradouro || endereco.cidade} – ${formatarCep(endereco.cep)}`
    : "";

  return (
    <div>
      {/* Barra fixa no topo — some por padrão, aparece quando o preço original
          sai de tela rolando pra cima */}
      <div
        className={`fixed inset-x-0 z-20 bg-white border-b border-line px-5 py-3 flex items-center justify-between gap-4 transition-transform ${
          mostrarBarraFixa ? "translate-y-0" : "-translate-y-full"
        }`}
        style={{ top: offsetHeader }}
      >
        <div className="min-w-0">
          <p className="font-mono text-lg font-semibold leading-none truncate">
            {reais(produto.preco)}
          </p>
          <p className="text-[11px] text-ink/50 mt-0.5">no Pix</p>
        </div>
        <button
          onClick={produto.requerPersonalizacao ? avancarPersonalizacao : comprarAgora}
          disabled={faltaEscolher}
          className="shrink-0 bg-pine text-white font-medium px-5 py-2.5 rounded-full text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {produto.requerPersonalizacao ? "Avançar" : "⚡ Comprar agora"}
        </button>
      </div>

      <div className="pb-8">
        {/* Voltar — só desktop; no mobile o header já tem a seta ao lado da busca */}
        <div className="hidden md:block mx-auto max-w-5xl px-5 pt-4">
          <button onClick={() => router.back()} className="text-sm text-ink/60 hover:text-ink">
            ← Voltar
          </button>
        </div>

        <div className="mx-auto max-w-5xl px-5 pt-4 grid md:grid-cols-2 gap-10">
          {/* Galeria com favorito e compartilhar */}
          <div className="relative h-fit">
            <ProdutoGaleria
              imagens={produto.imagens}
              video={produto.video}
              emoji={produto.emoji}
              cor={produto.cor}
              nome={produto.nome}
            />
            <FavoritoButton produto={produto} tamanho="lg" className="absolute top-3 right-3" />
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-ink/50 mb-2">
              {produto.categoriaLabel}
            </p>
            <h1 className="font-display text-3xl mb-5">{produto.nome}</h1>

            {/* Preço — bloco de referência: quando sai de tela, a barra fixa
                do topo assume o lugar dele */}
            <div ref={precoRef} className="pb-5 mb-5 border-b border-line">
              <p className="font-mono text-4xl font-semibold leading-none">
                {reais(produto.preco)}
              </p>
              <p className="text-sm text-ink/50 mt-2">no Pix ou em até 3x sem juros</p>
              {esgotado && (
                <p className="text-sm text-berry font-medium mt-3">Produto esgotado no momento</p>
              )}
              {estoqueBaixo && (
                <p className="text-sm text-mustard font-medium mt-3">
                  Só {produto.estoque} unidade{produto.estoque === 1 ? "" : "s"} em estoque
                </p>
              )}
            </div>

            {/* Comparação de preço, estilo "Achamos uma oferta melhor" */}
            {comparacao.mostrar && (
              <div className="bg-paper-2 border border-line rounded-lg p-4 mb-5">
                <p className="text-sm font-medium mb-3">Compare com a Shopee</p>
                <div className="bg-white border border-line rounded-lg p-4 flex items-center gap-4">
                  <div
                    className="w-16 h-16 rounded flex items-center justify-center text-3xl shrink-0 overflow-hidden"
                    style={{ backgroundColor: `${produto.cor}22` }}
                  >
                    {produto.imagens[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={produto.imagens[0]}
                        alt={produto.nome}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      produto.emoji
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-ink/50 line-through">
                      {reais(produto.precoShopee)} na Shopee
                    </p>
                    <p className="font-mono text-lg font-semibold">
                      {reais(produto.preco)}{" "}
                      <span className="text-berry text-sm font-normal">
                        -{comparacao.percentual}%
                      </span>
                    </p>
                    <p className="text-xs text-ink/50">sem taxa de plataforma</p>
                  </div>
                </div>
              </div>
            )}

            {/* Frete — resumo com "alterar", estilo Magalu; abre pra digitar
                de novo o CEP quando não há um endereço resolvido ainda */}
            <div className="border-b border-line pb-5 mb-5">
              {!mostrarInputCep && endereco ? (
                <div className="bg-paper-2 rounded-lg px-4 py-3 flex items-start justify-between gap-3">
                  <p className="text-sm">
                    📍 Enviar para <span className="font-medium">{resumoEndereco}</span>
                  </p>
                  <button
                    onClick={() => setAlterandoCep(true)}
                    className="text-pine text-sm font-medium shrink-0 hover:underline"
                  >
                    alterar
                  </button>
                </div>
              ) : (
                <label className="block">
                  <span className="block text-sm font-medium mb-1.5">
                    Calcular frete e prazo
                  </span>
                  <input
                    value={cep}
                    inputMode="numeric"
                    maxLength={9}
                    placeholder="00000-000"
                    onChange={(e) => setCepDigitado(formatarCep(e.target.value))}
                    className="w-full max-w-[160px] bg-white border border-line rounded-lg px-4 py-2.5 text-sm outline-none focus:border-pine"
                  />
                </label>
              )}

              {consultandoCep && <p className="text-xs text-ink/50 mt-2">Calculando...</p>}
              {erroCep && <p className="text-xs text-berry mt-2">{erroCep}</p>}
              {mostrarInputCep && !cep && !consultandoCep && !erroCep && (
                <p className="text-xs text-ink/40 mt-2">
                  Informe seu CEP pra ver o valor do frete antes de continuar.
                </p>
              )}

              {endereco && (
                <div className="flex items-center justify-between gap-4 mt-3">
                  <p className="text-sm text-ink/70">
                    🚚 Receba em até {endereco.frete.prazoDias} dias úteis
                  </p>
                  <p className="text-sm font-mono font-medium shrink-0">
                    {reais(endereco.frete.valor)}
                  </p>
                </div>
              )}
            </div>

            {produto.requerPersonalizacao && (
              <div className="bg-mustard/15 border border-mustard/40 text-pine-2 text-sm rounded-md px-4 py-3 mb-6">
                Este produto passa por um fluxo de personalização depois de escolhidas as
                variações.
              </div>
            )}

            {produto.variacoes.length > 0 && (
              <div className="space-y-6 mb-8">
                {produto.variacoes.map((v) => (
                  <div key={v.tipo}>
                    <p className="text-sm font-medium mb-2">{v.tipo}</p>
                    <div className="flex flex-wrap gap-2">
                      {v.valores.map((valor) => {
                        const ativo = selecoes[v.tipo] === valor;
                        return (
                          <button
                            key={valor}
                            onClick={() => setSelecoes((s) => ({ ...s, [v.tipo]: valor }))}
                            className={`px-4 py-2 rounded-full text-sm border transition-colors ${
                              ativo
                                ? "bg-pine text-white border-pine"
                                : "border-line hover:border-pine/50"
                            }`}
                          >
                            {valor}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* CTA — produto com personalização tem só um botão (não dá pra
                pular pro pagamento sem definir a arte antes); os demais têm
                a escolha "guardar e continuar navegando" vs. "ir direto pagar" */}
            {produto.requerPersonalizacao ? (
              <button
                onClick={avancarPersonalizacao}
                disabled={faltaEscolher}
                className="w-full inline-flex items-center justify-center gap-2 bg-pine text-white font-medium px-8 py-3.5 rounded-full disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition"
              >
                Avançar para personalização
              </button>
            ) : (
              <div className="space-y-2.5">
                <button
                  onClick={adicionarASacola}
                  disabled={faltaEscolher}
                  className="w-full inline-flex items-center justify-center gap-2 bg-pine text-white font-medium px-8 py-3.5 rounded-full disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition"
                >
                  👜 Adicionar à sacola
                </button>
                <button
                  onClick={comprarAgora}
                  disabled={faltaEscolher}
                  className="w-full inline-flex items-center justify-center gap-2 bg-white text-pine border border-pine font-medium px-8 py-3.5 rounded-full disabled:opacity-40 disabled:cursor-not-allowed hover:bg-pine/5 transition"
                >
                  ⚡ Comprar agora
                </button>
              </div>
            )}
            {faltaEscolher && (
              <p className="text-xs text-ink/40 mt-2">Escolha todas as variações pra continuar.</p>
            )}
          </div>
        </div>

        {/* Descrição detalhada — só aparece se a loja cadastrou */}
        {produto.descricaoDetalhada && (
          <div className="mx-auto max-w-5xl px-5 pt-8">
            <div className="bg-white border border-line rounded-lg p-5">
              <p className="text-sm font-medium mb-3">Detalhes do produto</p>
              <p className="text-sm text-ink/70 whitespace-pre-line">
                {produto.descricaoDetalhada}
              </p>
            </div>
          </div>
        )}

        <div className="mx-auto max-w-5xl px-5">
          <AvaliacoesProduto produtoId={produto.id} />
        </div>
      </div>
    </div>
  );
}

// Galeria da página do produto: fotos + vídeo com miniaturas, quando existem.
// Sem nenhum arquivo cadastrado, cai no emoji + cor de sempre.
type ItemGaleria = { tipo: "foto" | "video"; url: string };

function ProdutoGaleria({
  imagens,
  video,
  emoji,
  cor,
  nome,
}: {
  imagens: string[];
  video: string | null;
  emoji: string;
  cor: string;
  nome: string;
}) {
  const itens: ItemGaleria[] = [
    ...imagens.map((url): ItemGaleria => ({ tipo: "foto", url })),
    ...(video ? [{ tipo: "video", url: video } as ItemGaleria] : []),
  ];
  const [ativo, setAtivo] = useState(0);
  const [lightboxAberto, setLightboxAberto] = useState(false);

  if (itens.length === 0) {
    return (
      <div
        className="aspect-square rounded-lg flex items-center justify-center text-8xl"
        style={{ backgroundColor: `${cor}22` }}
      >
        {emoji}
      </div>
    );
  }

  const item = itens[Math.min(ativo, itens.length - 1)];

  return (
    <div>
      {item.tipo === "video" ? (
        <div
          className="w-full aspect-square rounded-lg overflow-hidden flex items-center justify-center"
          style={{ backgroundColor: `${cor}22` }}
        >
          <video src={item.url} className="w-full h-full object-cover" controls playsInline />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setLightboxAberto(true)}
          className="w-full aspect-square rounded-lg overflow-hidden flex items-center justify-center relative group"
          style={{ backgroundColor: `${cor}22` }}
          aria-label="Ver foto em tela cheia"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.url} alt={nome} className="w-full h-full object-cover" />
          <span className="absolute bottom-2 right-2 bg-black/50 text-white text-[11px] px-2 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            🔍 Ampliar
          </span>
        </button>
      )}

      {itens.length > 1 && (
        <div className="flex gap-2 mt-3">
          {itens.map((it, i) => (
            <button
              key={it.url}
              type="button"
              onClick={() => setAtivo(i)}
              className={`w-14 h-14 rounded overflow-hidden border-2 shrink-0 relative ${
                i === ativo ? "border-pine" : "border-transparent"
              }`}
              style={{ backgroundColor: `${cor}22` }}
            >
              {it.tipo === "video" ? (
                <>
                  <video src={it.url} className="w-full h-full object-cover" muted />
                  <span className="absolute inset-0 flex items-center justify-center text-white text-lg bg-black/25">
                    ▶
                  </span>
                </>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.url} alt="" className="w-full h-full object-cover" />
              )}
            </button>
          ))}
        </div>
      )}

      {lightboxAberto && (
        <Lightbox
          itens={itens}
          indiceInicial={Math.min(ativo, itens.length - 1)}
          nome={nome}
          onFechar={() => setLightboxAberto(false)}
        />
      )}
    </div>
  );
}
