"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useProduto } from "@/lib/use-produto";
import { useCart } from "@/lib/cart-context";
import { useConta } from "@/lib/conta-context";
import { useCep } from "@/lib/use-cep";
import { calcularDesconto, compararPreco } from "@/lib/compare-price";
import { formatarCep, normalizarCep } from "@/lib/frete";
import {
  controladoPorVariacao,
  estoqueDaCombinacao,
  precoEfetivo,
  produtoEsgotado,
  tipoTemFotoPorValor,
} from "@/lib/estoque-variacao";
import FavoritoButton from "@/components/FavoritoButton";
import AvaliacoesProduto from "@/components/AvaliacoesProduto";
import Lightbox from "@/components/Lightbox";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";

function reais(valor: number) {
  return `R$ ${valor.toFixed(2).replace(".", ",")}`;
}

export default function ProdutoPageClient() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { produto, carregando } = useProduto(id);
  const { iniciarItem, definirQuantidade } = useCart();
  const { enderecos } = useConta();

  const [selecoes, setSelecoes] = useState<Record<string, string>>({});
  const [corHover, setCorHover] = useState<string | null>(null);
  const [quantidade, setQuantidade] = useState(1);
  // Produto carrega assíncrono — assim que a quantidade mínima chega, o
  // seletor já parte dela em vez de 1 (que pode nem ser um valor válido).
  // setState durante a renderização (não em efeito) é o padrão recomendado
  // pra ajustar estado quando um prop muda — evita o passo extra de efeito.
  const [produtoIdVisto, setProdutoIdVisto] = useState(produto?.id);
  if (produto && produto.id !== produtoIdVisto) {
    setProdutoIdVisto(produto.id);
    setQuantidade(produto.quantidadeMinima || 1);
  }

  // Quem já tem endereço salvo começa com o CEP dele preenchido; digitar por
  // cima assume o controle do campo (`null` = ainda não mexeu).
  const enderecoPadrao = enderecos.find((e) => e.padrao) ?? enderecos[0];
  const cepPadrao = enderecoPadrao ? normalizarCep(enderecoPadrao.cep) : null;
  const [cepDigitado, setCepDigitado] = useState<string | null>(null);
  const cep = cepDigitado ?? (cepPadrao ? formatarCep(cepPadrao) : "");
  const { endereco, erro: erroCep, consultando: consultandoCep } = useCep(cep, id, quantidade);

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

  // Preço final considerando a variação escolhida (ex: "Tamanho imã": 7x7 =
  // R$1). Sem seleção ainda, ou sem preço específico pro valor, cai no
  // preço normal do produto — mesma regra do servidor em criarPedido.
  const precoAtual = precoEfetivo(produto, selecoes);
  const comparacao = compararPreco(produto.precoShopee, precoAtual, produto.vendidoNaShopee);
  // precoOriginal (o "riscado") é do produto base — não vale pra um valor de
  // variação com preço próprio, então o badge de desconto some nesse caso
  // (ver o porquê em calcularDesconto).
  const desconto = calcularDesconto(precoAtual, produto.precoOriginal, {
    usaPrecoVariacao: precoAtual !== produto.preco,
  });

  // Variação de cor com fotos próprias: ao selecionar um valor, a galeria
  // grande passa a mostrar essas fotos em vez das fotos gerais do produto.
  // Sem cor selecionada (ou cor sem fotos cadastradas), cai nas fotos gerais.
  const variacaoCor = produto.variacoes.find((v) => tipoTemFotoPorValor(v.tipo));
  const corSelecionada = variacaoCor ? selecoes[variacaoCor.tipo] : undefined;
  // Passar o mouse sobre o swatch prevalece sobre a cor já escolhida — some
  // ao tirar o mouse, voltando pra cor selecionada (ou pras fotos gerais).
  const corParaGaleria = corHover ?? corSelecionada;
  const imagensDaCor = corParaGaleria ? variacaoCor?.imagensValores?.[corParaGaleria] : undefined;
  const imagensGaleria =
    imagensDaCor && imagensDaCor.length > 0 ? imagensDaCor : produto.imagens;
  // Sem cor escolhida/hover, as setas também alcançam as fotos de cada cor —
  // assim um produto com só 1 foto principal ainda dá pra passar pra frente
  // e cair nas fotos das variações cadastradas.
  const imagensTodasCores =
    !corParaGaleria && variacaoCor?.imagensValores
      ? Object.values(variacaoCor.imagensValores).flat()
      : [];
  const imagensGaleriaCompleta = [
    ...imagensGaleria,
    ...imagensTodasCores.filter((url) => !imagensGaleria.includes(url)),
  ];

  // Com variações e controle ligado, o estoque é por combinação — o aviso
  // de "esgotado" no bloco de preço vira só um resumo geral (soma de tudo);
  // o aviso específico da combinação escolhida aparece junto das variações,
  // mais abaixo.
  const porVariacao = controladoPorVariacao(produto);
  const esgotado = produtoEsgotado(produto);
  const estoqueBaixo =
    !porVariacao && produto.estoque !== null && produto.estoque > 0 && produto.estoque <= 5;

  const faltaSelecionar = produto.variacoes.some((v) => !selecoes[v.tipo]);
  const estoqueCombinacaoEscolhida =
    porVariacao && !faltaSelecionar ? estoqueDaCombinacao(produto, selecoes) : null;
  const combinacaoSemEstoque = estoqueCombinacaoEscolhida === 0;
  const faltaEscolher =
    faltaSelecionar || combinacaoSemEstoque || (!porVariacao && esgotado);

  // Teto pra quantidade: estoque da combinação escolhida (produto com
  // variação) ou estoque geral (sem variação). null em qualquer um dos dois
  // significa "não controlado" — sem teto, então.
  const estoqueMaximo = porVariacao ? estoqueCombinacaoEscolhida : produto.estoque;
  const quantidadeMinima = Math.max(1, produto.quantidadeMinima || 1);
  // Trocar cor/tamanho pode reduzir o estoque disponível pra menos do que já
  // estava pedido no seletor — clampa na exibição em vez de deixar pedir mais
  // do que tem (sem precisar de efeito pra sincronizar o estado de volta).
  // Item personalizado é sempre 1 unidade (ver criarPedido) — mesmo se o
  // produto também tiver quantidadePersonalizavel ligado, ninguém escolhe
  // quantidade aqui: o seletor nem aparece, mais abaixo.
  const quantidadeEfetiva = produto.requerPersonalizacao
    ? 1
    : Math.max(
        quantidadeMinima,
        estoqueMaximo != null
          ? Math.min(quantidade, Math.max(quantidadeMinima, estoqueMaximo))
          : quantidade
      );

  // Um valor de variação é marcado como indisponível só quando dá pra saber
  // que a combinação resultante está zerada — ou seja, quando faltar escolher
  // no máximo este tipo. Com outros tipos ainda em aberto não dá pra cravar,
  // então o valor aparece normal.
  //
  // A marca vale também pro valor já escolhido: sem isso o chip selecionado
  // ficava com a cor de "ok" mesmo levando a uma combinação zerada, e o único
  // sinal era o aviso mais abaixo.
  //
  // Marcado não é bloqueado: o botão continua clicável pra dar pra trocar de
  // ideia sem ficar preso (escolher a cor esgotada e depois mudar o tamanho,
  // por exemplo). Quem segura a compra é o aviso da combinação + os CTAs
  // desabilitados por `faltaEscolher`.
  function valorIndisponivel(tipo: string, valor: string) {
    if (!porVariacao) return false;
    const tentativa = { ...selecoes, [tipo]: valor };
    const completa = produto!.variacoes.every((v) => tentativa[v.tipo]);
    if (!completa) return false;
    return estoqueDaCombinacao(produto!, tentativa) === 0;
  }

  // Personalização não tem como pular pro pagamento sem antes definir a arte
  // — por isso só existe um botão nesse caso, sem a escolha "sacola vs. agora".
  function avancarPersonalizacao() {
    if (!produto || faltaEscolher) return;
    iniciarItem(produto.id, selecoes, normalizarCep(cep) ?? undefined);
    definirQuantidade(quantidadeEfetiva);
    router.push(`/personalizar/${produto.id}`);
  }

  // Guarda o item e já manda direto pro checkout — o CEP calculado aqui segue
  // junto, o checkout começa com ele preenchido em vez de pedir de novo.
  function comprarAgora() {
    if (!produto || faltaEscolher) return;
    iniciarItem(produto.id, selecoes, normalizarCep(cep) ?? undefined);
    definirQuantidade(quantidadeEfetiva);
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
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <p className="font-mono text-lg font-semibold leading-none truncate">
              {reais(precoAtual)}
            </p>
            {desconto.ativo && (
              <p className="font-mono text-xs text-ink/40 line-through">
                {reais(produto.precoOriginal!)}
              </p>
            )}
          </div>
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
              key={corParaGaleria ?? "padrao"}
              imagens={imagensGaleriaCompleta}
              video={produto.video}
              emoji={produto.emoji}
              cor={produto.cor}
              nome={produto.nome}
              descontoPercentual={desconto.ativo ? desconto.percentual : undefined}
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
              <div className="flex items-baseline gap-3 flex-wrap">
                <p className="font-mono text-4xl font-semibold leading-none">
                  {reais(precoAtual)}
                </p>
                {desconto.ativo && (
                  <>
                    <p className="font-mono text-lg text-ink/40 line-through">
                      {reais(produto.precoOriginal!)}
                    </p>
                    <span className="bg-berry text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                      -{desconto.percentual}%
                    </span>
                  </>
                )}
              </div>
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
                      {reais(precoAtual)}{" "}
                      <span className="text-berry text-sm font-normal">
                        -{comparacao.percentual}%
                      </span>
                    </p>
                    <p className="text-xs text-ink/50">sem taxa de plataforma</p>
                  </div>
                </div>
              </div>
            )}

            {(produto.requerPersonalizacao || produto.mensagemPersonalizacao) && (
              <div className="bg-mustard/15 border border-mustard/40 text-pine-2 text-sm rounded-md px-4 py-3 mb-6">
                {produto.mensagemPersonalizacao ||
                  "Este produto passa por um fluxo de personalização depois de escolhidas as variações."}
              </div>
            )}

            {produto.variacoes.length > 0 && (
              <div className="space-y-6 mb-6">
                {produto.variacoes.map((v) => {
                  // Cor com pelo menos uma foto cadastrada vira swatch de
                  // imagem (com risco diagonal pra indisponível); sem foto
                  // nenhuma, ou outro tipo qualquer, continua chip de texto.
                  const ehCorComFoto =
                    tipoTemFotoPorValor(v.tipo) &&
                    v.imagensValores &&
                    Object.keys(v.imagensValores).length > 0;

                  return (
                    <div key={v.tipo}>
                      <p className="text-sm font-medium mb-2">
                        {v.tipo}
                        {ehCorComFoto && selecoes[v.tipo] && (
                          <span className="text-ink/50 font-normal">: {selecoes[v.tipo]}</span>
                        )}
                      </p>

                      {ehCorComFoto ? (
                        <div className="grid grid-cols-5 gap-2 max-w-xs">
                          {v.valores.map((valor) => {
                            const ativo = selecoes[v.tipo] === valor;
                            const indisponivel = valorIndisponivel(v.tipo, valor);
                            const url = v.imagensValores?.[valor]?.[0];
                            return (
                              <button
                                key={valor}
                                onClick={() => setSelecoes((s) => ({ ...s, [v.tipo]: valor }))}
                                onMouseEnter={() => setCorHover(valor)}
                                onMouseLeave={() => setCorHover(null)}
                                title={indisponivel ? "Sem estoque nessa combinação" : valor}
                                className={`relative aspect-square rounded-sm overflow-hidden border-2 transition-colors ${
                                  ativo && indisponivel
                                    ? "border-berry"
                                    : ativo
                                      ? "border-ink"
                                      : "border-line hover:border-ink/40"
                                }`}
                              >
                                {url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={url}
                                    alt={valor}
                                    className={`w-full h-full object-cover ${
                                      indisponivel ? "opacity-50" : ""
                                    }`}
                                  />
                                ) : (
                                  <span className="w-full h-full flex items-center justify-center text-[10px] bg-paper-2 px-0.5 text-center leading-tight">
                                    {valor}
                                  </span>
                                )}
                                {indisponivel && (
                                  <svg
                                    viewBox="0 0 100 100"
                                    preserveAspectRatio="none"
                                    className="absolute inset-0 w-full h-full"
                                  >
                                    <line
                                      x1="0"
                                      y1="0"
                                      x2="100"
                                      y2="100"
                                      stroke={ativo ? "#b23a48" : "#8A818C"}
                                      strokeWidth="2"
                                    />
                                  </svg>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {v.valores.map((valor) => {
                            const ativo = selecoes[v.tipo] === valor;
                            const indisponivel = valorIndisponivel(v.tipo, valor);
                            return (
                              <button
                                key={valor}
                                onClick={() => setSelecoes((s) => ({ ...s, [v.tipo]: valor }))}
                                title={indisponivel ? "Sem estoque nessa combinação" : undefined}
                                className={`px-4 py-2 rounded-full text-sm border transition-colors ${
                                  ativo && indisponivel
                                    ? "bg-berry/10 text-berry border-berry line-through"
                                    : ativo
                                      ? "bg-pine text-white border-pine"
                                      : indisponivel
                                        ? "border-dashed border-line text-ink/30 line-through"
                                        : "border-line hover:border-pine/50"
                                }`}
                              >
                                {valor}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Aviso da combinação escolhida — só aparece com todas as
                    variações definidas e controle de estoque por variação
                    ligado. */}
                {porVariacao && !faltaSelecionar && (
                  <p
                    className={`text-sm font-medium ${
                      combinacaoSemEstoque ? "text-berry" : "text-ink/60"
                    }`}
                  >
                    {combinacaoSemEstoque
                      ? "Sem estoque para essa combinação no momento."
                      : estoqueCombinacaoEscolhida !== null && estoqueCombinacaoEscolhida <= 5
                        ? `Só ${estoqueCombinacaoEscolhida} unidade${
                            estoqueCombinacaoEscolhida === 1 ? "" : "s"
                          } dessa combinação`
                        : null}
                  </p>
                )}
              </div>
            )}

            {/* Quantidade — acima do CTA, linha própria. Produto com
                quantidadePersonalizavel troca o stepper por um campo livre,
                pra pedido grande (ex: 554un) sem clicar um por um.
                Sem seletor nenhum quando o produto requer personalização:
                item personalizado é sempre 1 unidade (ver criarPedido), então
                deixar escolher aqui só levaria a um erro no fim do fluxo de
                arte, depois do cliente já ter preenchido tudo. */}
            {!produto.requerPersonalizacao && (
              <div className="mb-4">
                <p className="text-sm font-medium mb-2">Quantidade</p>
                {produto.quantidadePersonalizavel ? (
                  <input
                    type="number"
                    inputMode="numeric"
                    min={quantidadeMinima}
                    max={estoqueMaximo ?? undefined}
                    value={quantidade}
                    onChange={(e) => {
                      const valor = Math.round(Number(e.target.value));
                      setQuantidade(Number.isFinite(valor) && valor > 0 ? valor : quantidadeMinima);
                    }}
                    onBlur={() => setQuantidade(quantidadeEfetiva)}
                    className="w-24 h-10 border border-line rounded-full text-center text-sm font-medium tabular-nums"
                  />
                ) : (
                  <div className="inline-flex items-center border border-line rounded-full">
                    <button
                      type="button"
                      onClick={() => setQuantidade((q) => Math.max(quantidadeMinima, q - 1))}
                      disabled={quantidadeEfetiva <= quantidadeMinima}
                      aria-label="Diminuir quantidade"
                      className="w-10 h-10 flex items-center justify-center text-lg text-ink/70 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      −
                    </button>
                    <span className="w-10 text-center text-sm font-medium tabular-nums">
                      {quantidadeEfetiva}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setQuantidade((q) =>
                          estoqueMaximo != null ? Math.min(estoqueMaximo, q + 1) : q + 1
                        )
                      }
                      disabled={estoqueMaximo != null && quantidadeEfetiva >= estoqueMaximo}
                      aria-label="Aumentar quantidade"
                      className="w-10 h-10 flex items-center justify-center text-lg text-ink/70 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      +
                    </button>
                  </div>
                )}
                {quantidadeMinima > 1 && (
                  <p className="text-xs text-ink/40 mt-1">Pedido mínimo: {quantidadeMinima} unidades.</p>
                )}
                {estoqueMaximo != null && estoqueMaximo > 0 && quantidadeEfetiva >= estoqueMaximo && (
                  <p className="text-xs text-ink/40 mt-1">Máximo disponível em estoque.</p>
                )}
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
                    🚚 Receba em até{" "}
                    {endereco.frete.prazoDias + produto.diasProducaoExtra}{" "}
                    dias úteis
                    {produto.diasProducaoExtra > 0 && (
                      <span className="text-ink/40"> (inclui produção)</span>
                    )}
                  </p>
                  <p className="text-sm font-mono font-medium shrink-0">
                    {reais(endereco.frete.valor)}
                  </p>
                </div>
              )}
            </div>

            {/* CTA — botão único: personalização avança pro editor de arte,
                os demais produtos vão direto pro checkout */}
            {produto.requerPersonalizacao ? (
              <button
                onClick={avancarPersonalizacao}
                disabled={faltaEscolher}
                className="w-full inline-flex items-center justify-center gap-2 bg-pine text-white font-medium px-8 py-3.5 rounded-full disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition"
              >
                Avançar para personalização
              </button>
            ) : (
              <button
                onClick={comprarAgora}
                disabled={faltaEscolher}
                className="w-full inline-flex items-center justify-center gap-2 bg-pine text-white font-medium px-8 py-3.5 rounded-full disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition"
              >
                ⚡ Comprar agora
              </button>
            )}
            {faltaEscolher && !combinacaoSemEstoque && faltaSelecionar && (
              <p className="text-xs text-ink/40 mt-2">Escolha todas as variações pra continuar.</p>
            )}
          </div>
        </div>

        {/* Descrição detalhada — só aparece se a loja cadastrou */}
        {produto.descricaoDetalhada && (
          <div className="mx-auto max-w-5xl px-5 pt-8">
            <div className="bg-white border border-line rounded-lg p-5">
              <p className="text-sm font-medium mb-3">Detalhes do produto</p>
              <DescricaoDetalhada texto={produto.descricaoDetalhada} nome={produto.nome} />
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
  descontoPercentual,
}: {
  imagens: string[];
  video: string | null;
  emoji: string;
  cor: string;
  nome: string;
  descontoPercentual?: number;
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

  const indiceAtivo = Math.min(ativo, itens.length - 1);
  const item = itens[indiceAtivo];
  const anterior = () => setAtivo((i) => (i - 1 + itens.length) % itens.length);
  const proximo = () => setAtivo((i) => (i + 1) % itens.length);

  return (
    <div>
      <div className="relative">
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

        {!!descontoPercentual && (
          <span className="absolute top-3 left-3 bg-berry text-white text-xs font-semibold px-3 py-1 rounded-full">
            {descontoPercentual}% OFF
          </span>
        )}
      </div>

      {itens.length > 1 && (
        <div className="flex items-center justify-center gap-6 mt-3">
          <button
            type="button"
            onClick={anterior}
            aria-label="Foto anterior"
            className="w-8 h-8 flex items-center justify-center text-ink/50 hover:text-ink transition-colors"
          >
            <ChevronLeft className="w-6 h-6" strokeWidth={2.5} />
          </button>
          <span className="text-sm text-ink/60 tabular-nums">
            {indiceAtivo + 1} / {itens.length}
          </span>
          <button
            type="button"
            onClick={proximo}
            aria-label="Próxima foto"
            className="w-8 h-8 flex items-center justify-center text-ink/50 hover:text-ink transition-colors"
          >
            <ChevronRight className="w-6 h-6" strokeWidth={2.5} />
          </button>
        </div>
      )}

      {lightboxAberto && (
        <Lightbox
          itens={itens}
          indiceInicial={indiceAtivo}
          nome={nome}
          onFechar={() => setLightboxAberto(false)}
        />
      )}
    </div>
  );
}

// Suporta markdown (negrito, listas, títulos, tabelas) e também HTML colado
// direto (ex.: tabela de medidas com style inline) — rehypeRaw interpreta as
// tags e rehypeSanitize filtra pra não abrir brecha de script/onClick, só
// liberando `style`/`class` a mais que o padrão já permite. O botão
// "+ Inserir imagem" do admin grava `![](url)`, que cai na regra de <img>.
const schemaSanitizacao = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    "*": [...(defaultSchema.attributes?.["*"] ?? []), "style", "className"],
  },
};

function DescricaoDetalhada({ texto, nome }: { texto: string; nome: string }) {
  return (
    <div className="text-sm text-ink/70 space-y-3 [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:text-ink [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-ink [&_h3]:font-semibold [&_h3]:text-ink [&_strong]:text-ink [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_a]:underline [&_a]:text-berry [&_table]:max-w-full [&_table]:overflow-x-auto [&_table]:block">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, schemaSanitizacao]]}
        components={{
          img: ({ src, alt }) =>
            typeof src === "string" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt={alt || nome}
                className="w-full rounded-lg object-cover"
              />
            ) : null,
        }}
      >
        {texto}
      </ReactMarkdown>
    </div>
  );
}
