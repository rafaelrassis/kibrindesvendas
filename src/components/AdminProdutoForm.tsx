"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Categoria, ProdutoAdmin } from "@/lib/types";
import EditorFoto from "@/components/EditorFoto";

type VariacaoForm = { tipo: string; valores: string };
type MaterialForm = { nome: string; quantidade: string; custoUnitario: string };

function paraVariacaoForm(v: ProdutoAdmin["variacoes"]): VariacaoForm[] {
  return v.map((x) => ({ tipo: x.tipo, valores: x.valores.join(", ") }));
}

function paraMaterialForm(m: ProdutoAdmin["materiais"] | undefined): MaterialForm[] {
  return (m ?? []).map((x) => ({
    nome: x.nome,
    quantidade: String(x.quantidade),
    custoUnitario: String(x.custoUnitario),
  }));
}

function reais(valor: number) {
  return `R$ ${valor.toFixed(2).replace(".", ",")}`;
}

export default function AdminProdutoForm({ produto }: { produto?: ProdutoAdmin }) {
  const router = useRouter();
  const editando = !!produto;

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [nome, setNome] = useState(produto?.nome ?? "");
  const [descricao, setDescricao] = useState(produto?.descricao ?? "");
  const [descricaoDetalhada, setDescricaoDetalhada] = useState(
    produto?.descricaoDetalhada ?? ""
  );
  const [categoriaSlug, setCategoriaSlug] = useState(produto?.categoria ?? "");
  const [preco, setPreco] = useState(produto?.preco?.toString() ?? "");
  const [precoShopee, setPrecoShopee] = useState(produto?.precoShopee?.toString() ?? "");
  const [vendidoNaShopee, setVendidoNaShopee] = useState(produto?.vendidoNaShopee ?? true);
  const [emoji, setEmoji] = useState(produto?.emoji ?? "🎁");
  const [cor, setCor] = useState(produto?.cor ?? "#3F6B4C");
  const [imagens, setImagens] = useState<string[]>(produto?.imagens ?? []);
  const [video, setVideo] = useState<string | null>(produto?.video ?? null);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [erroFoto, setErroFoto] = useState("");
  const [arquivoParaEditar, setArquivoParaEditar] = useState<File | null>(null);
  const [enviandoVideo, setEnviandoVideo] = useState(false);
  const [erroVideo, setErroVideo] = useState("");
  const [requerPersonalizacao, setRequerPersonalizacao] = useState(
    produto?.requerPersonalizacao ?? false
  );
  const [destaque, setDestaque] = useState(produto?.destaque ?? false);
  // Vazio = estoque não controlado (comportamento de sempre). Só quando o
  // admin preenche um número é que a compra passa a travar nele.
  const [controlaEstoque, setControlaEstoque] = useState(produto?.estoque != null);
  const [estoque, setEstoque] = useState(
    produto?.estoque != null ? String(produto.estoque) : ""
  );
  const [pesoGramas, setPesoGramas] = useState(String(produto?.pesoGramas ?? 300));
  const [alturaCm, setAlturaCm] = useState(String(produto?.alturaCm ?? 4));
  const [larguraCm, setLarguraCm] = useState(String(produto?.larguraCm ?? 11));
  const [comprimentoCm, setComprimentoCm] = useState(String(produto?.comprimentoCm ?? 16));
  const [variacoes, setVariacoes] = useState<VariacaoForm[]>(
    produto ? paraVariacaoForm(produto.variacoes) : []
  );
  const [materiais, setMateriais] = useState<MaterialForm[]>(paraMaterialForm(produto?.materiais));
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    fetch("/api/categorias")
      .then((r) => r.json())
      .then((cs: Categoria[]) => {
        setCategorias(cs);
        if (!categoriaSlug && cs[0]) setCategoriaSlug(cs[0].slug);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function atualizarVariacao(i: number, campo: keyof VariacaoForm, valor: string) {
    setVariacoes((prev) => prev.map((v, idx) => (idx === i ? { ...v, [campo]: valor } : v)));
  }

  function removerVariacao(i: number) {
    setVariacoes((prev) => prev.filter((_, idx) => idx !== i));
  }

  // A escolha do arquivo abre o editor (zoom/arraste/rotação); só depois de
  // confirmar lá é que o upload de verdade acontece, sempre como JPEG — não
  // importa se a foto original era HEIC, PNG etc.
  function selecionarFotoBruta(arquivo: File | undefined) {
    if (!arquivo) return;
    if (imagens.length >= 4) {
      setErroFoto("No máximo 4 fotos por produto.");
      return;
    }
    setErroFoto("");
    setArquivoParaEditar(arquivo);
  }

  async function enviarFotoEditada(arquivo: File) {
    setArquivoParaEditar(null);
    setEnviandoFoto(true);
    const form = new FormData();
    form.append("arquivo", arquivo);
    try {
      const r = await fetch("/api/admin/imagens", { method: "POST", body: form });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Não foi possível enviar a foto.");
      setImagens((prev) => [...prev, data.url]);
    } catch (e) {
      setErroFoto(e instanceof Error ? e.message : "Não foi possível enviar a foto.");
    } finally {
      setEnviandoFoto(false);
    }
  }

  function removerFoto(url: string) {
    setImagens((prev) => prev.filter((u) => u !== url));
  }

  // A primeira foto do array é a capa em toda a loja (cartão da home, busca,
  // comparativo) — isso já é automático em quem lê `imagens[0]`. O que essa
  // função dá é o controle de qual foto ocupa essa posição.
  function tornarCapa(url: string) {
    setImagens((prev) => [url, ...prev.filter((u) => u !== url)]);
  }

  async function selecionarVideo(arquivo: File | undefined) {
    if (!arquivo) return;
    setErroVideo("");
    setEnviandoVideo(true);
    const form = new FormData();
    form.append("arquivo", arquivo);
    try {
      const r = await fetch("/api/admin/videos", { method: "POST", body: form });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Não foi possível enviar o vídeo.");
      setVideo(data.url);
    } catch (e) {
      setErroVideo(e instanceof Error ? e.message : "Não foi possível enviar o vídeo.");
    } finally {
      setEnviandoVideo(false);
    }
  }

  function atualizarMaterial(i: number, campo: keyof MaterialForm, valor: string) {
    setMateriais((prev) => prev.map((m, idx) => (idx === i ? { ...m, [campo]: valor } : m)));
  }

  function removerMaterial(i: number) {
    setMateriais((prev) => prev.filter((_, idx) => idx !== i));
  }

  // Cálculo ao vivo, só pra guiar o cadastro — o valor de verdade é
  // recalculado no servidor a partir do que for salvo.
  const custoTotal = materiais.reduce((soma, m) => {
    const qtd = Number(m.quantidade.replace(",", "."));
    const custo = Number(m.custoUnitario.replace(",", "."));
    return soma + (Number.isFinite(qtd) && Number.isFinite(custo) ? qtd * custo : 0);
  }, 0);
  const precoNum = Number(preco.replace(",", ".")) || 0;
  const lucro = precoNum - custoTotal;
  const margem = precoNum > 0 ? (lucro / precoNum) * 100 : null;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");

    if (!nome.trim() || !categoriaSlug || !preco) {
      setErro("Preencha nome, categoria e preço.");
      return;
    }
    if (controlaEstoque && !(Number(estoque) >= 0)) {
      setErro("Informe um estoque válido (0 ou mais) ou desative o controle.");
      return;
    }

    const payload = {
      nome,
      descricao,
      descricaoDetalhada: descricaoDetalhada.trim() || null,
      categoriaSlug,
      preco: Number(preco),
      precoShopee: precoShopee ? Number(precoShopee) : Number(preco),
      vendidoNaShopee,
      requerPersonalizacao,
      emoji,
      cor,
      imagens,
      video,
      destaque,
      estoque: controlaEstoque ? Math.round(Number(estoque)) : null,
      pesoGramas: Number(pesoGramas) || 300,
      alturaCm: Number(alturaCm) || 4,
      larguraCm: Number(larguraCm) || 11,
      comprimentoCm: Number(comprimentoCm) || 16,
      variacoes: variacoes
        .filter((v) => v.tipo.trim())
        .map((v) => ({
          tipo: v.tipo.trim(),
          valores: v.valores.split(",").map((x) => x.trim()).filter(Boolean),
        })),
      materiais: materiais
        .filter((m) => m.nome.trim())
        .map((m) => ({
          nome: m.nome.trim(),
          quantidade: Number(m.quantidade.replace(",", ".")) || 0,
          custoUnitario: Number(m.custoUnitario.replace(",", ".")) || 0,
        })),
    };

    setEnviando(true);
    const r = await fetch(
      editando ? `/api/admin/produtos/${produto!.id}` : "/api/admin/produtos",
      {
        method: editando ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    const data = await r.json();
    setEnviando(false);

    if (!r.ok) {
      setErro(data.error ?? "Não foi possível salvar.");
      return;
    }
    router.push("/admin/produtos");
  }

  return (
    <form onSubmit={enviar} className="space-y-4 max-w-xl">
      <Campo label="Nome">
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="w-full border border-line rounded px-3 py-2 text-sm"
          required
        />
      </Campo>

      <Campo label="Descrição">
        <textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          className="w-full border border-line rounded px-3 py-2 text-sm"
          rows={3}
        />
      </Campo>

      <Campo label="Descrição detalhada">
        <textarea
          value={descricaoDetalhada}
          onChange={(e) => setDescricaoDetalhada(e.target.value)}
          className="w-full border border-line rounded px-3 py-2 text-sm"
          rows={5}
          placeholder="Materiais, medidas, cuidados, o que vem incluso... aparece numa seção própria na página do produto."
        />
        <p className="text-xs text-ink/50 mt-1">Opcional. Sem isso, a página mostra só a descrição curta.</p>
      </Campo>

      <Campo label="Categoria">
        <select
          value={categoriaSlug}
          onChange={(e) => setCategoriaSlug(e.target.value)}
          className="w-full border border-line rounded px-3 py-2 text-sm"
        >
          {categorias.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.label}
            </option>
          ))}
        </select>
      </Campo>

      <div className="grid grid-cols-2 gap-4">
        <Campo label="Preço (site)">
          <input
            type="number"
            step="0.01"
            value={preco}
            onChange={(e) => setPreco(e.target.value)}
            className="w-full border border-line rounded px-3 py-2 text-sm"
            required
          />
        </Campo>
        <Campo label="Preço (Shopee)">
          <input
            type="number"
            step="0.01"
            value={precoShopee}
            onChange={(e) => setPrecoShopee(e.target.value)}
            className="w-full border border-line rounded px-3 py-2 text-sm"
            placeholder="opcional"
          />
        </Campo>
      </div>

      <div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={vendidoNaShopee}
            onChange={(e) => setVendidoNaShopee(e.target.checked)}
          />
          Também vendido na Shopee
        </label>
        <p className="text-xs text-ink/50 mt-1">
          Desligado, o site nunca mostra o comparativo de preço deste produto, mesmo com
          o preço da Shopee preenchido.
        </p>
      </div>

      <div>
        <p className="text-sm font-medium mb-1">Fotos e vídeo</p>
        <p className="text-xs text-ink/50 mb-3">
          Até 4 fotos e 1 vídeo. A primeira é a capa mostrada na home e na busca — toque em
          &quot;Tornar capa&quot; pra trocar. Sem nenhum arquivo aqui, o produto usa o emoji + cor abaixo.
        </p>

        <div className="flex flex-wrap gap-3 mb-3">
          {imagens.map((url, i) => (
            <div key={url} className="relative w-20 h-20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="w-20 h-20 rounded object-cover border border-line" />
              {i === 0 ? (
                <span className="absolute bottom-0 inset-x-0 bg-pine/90 text-white text-[9px] text-center py-0.5 rounded-b">
                  Capa
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => tornarCapa(url)}
                  className="absolute bottom-0 inset-x-0 bg-ink/60 text-white text-[9px] text-center py-0.5 rounded-b hover:bg-pine/90"
                >
                  Tornar capa
                </button>
              )}
              <button
                type="button"
                onClick={() => removerFoto(url)}
                className="absolute -top-2 -right-2 bg-berry text-white rounded-full w-5 h-5 text-xs leading-none"
              >
                ×
              </button>
            </div>
          ))}

          {imagens.length < 4 && (
            <label className="w-20 h-20 border-2 border-dashed border-line rounded flex items-center justify-center text-center cursor-pointer hover:border-mustard transition-colors">
              <input
                type="file"
                accept="image/*,.heic,.heif"
                className="hidden"
                disabled={enviandoFoto}
                onChange={(e) => {
                  selecionarFotoBruta(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <span className="text-[11px] text-ink/50 px-1">
                {enviandoFoto ? "Enviando..." : "+ Foto"}
              </span>
            </label>
          )}
        </div>
        {erroFoto && <p className="text-xs text-berry mb-3">{erroFoto}</p>}

        {video ? (
          <div className="flex items-center gap-3">
            <video src={video} className="w-20 h-20 rounded object-cover border border-line" muted />
            <button
              type="button"
              onClick={() => setVideo(null)}
              className="text-berry text-xs hover:underline"
            >
              Remover vídeo
            </button>
          </div>
        ) : (
          <label className="inline-block border-2 border-dashed border-line rounded-md px-4 py-2 text-center cursor-pointer hover:border-mustard transition-colors">
            <input
              type="file"
              accept="video/mp4"
              className="hidden"
              disabled={enviandoVideo}
              onChange={(e) => selecionarVideo(e.target.files?.[0])}
            />
            <span className="text-sm text-ink/50">
              {enviandoVideo ? "Enviando..." : "Clique pra escolher um vídeo (MP4, até 30MB)"}
            </span>
          </label>
        )}
        {erroVideo && <p className="text-xs text-berry mt-2">{erroVideo}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Campo label="Emoji (usado quando não há fotos)">
          <input
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            className="w-full border border-line rounded px-3 py-2 text-sm"
            maxLength={4}
          />
        </Campo>
        <Campo label="Cor">
          <input
            type="color"
            value={cor}
            onChange={(e) => setCor(e.target.value)}
            className="w-full border border-line rounded px-3 py-1 h-10"
          />
        </Campo>
      </div>

      <div>
        <p className="text-sm font-medium mb-2">Peso e dimensões (embalagem)</p>
        <p className="text-xs text-ink/50 mb-2">
          Usados na cotação real de frete pelos Correios. Sem esses dados o cálculo cai
          na estimativa por região.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Campo label="Peso (g)">
            <input
              type="number"
              min={1}
              value={pesoGramas}
              onChange={(e) => setPesoGramas(e.target.value)}
              className="w-full border border-line rounded px-3 py-2 text-sm"
            />
          </Campo>
          <Campo label="Altura (cm)">
            <input
              type="number"
              min={1}
              value={alturaCm}
              onChange={(e) => setAlturaCm(e.target.value)}
              className="w-full border border-line rounded px-3 py-2 text-sm"
            />
          </Campo>
          <Campo label="Largura (cm)">
            <input
              type="number"
              min={1}
              value={larguraCm}
              onChange={(e) => setLarguraCm(e.target.value)}
              className="w-full border border-line rounded px-3 py-2 text-sm"
            />
          </Campo>
          <Campo label="Comprimento (cm)">
            <input
              type="number"
              min={1}
              value={comprimentoCm}
              onChange={(e) => setComprimentoCm(e.target.value)}
              className="w-full border border-line rounded px-3 py-2 text-sm"
            />
          </Campo>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={requerPersonalizacao}
          onChange={(e) => setRequerPersonalizacao(e.target.checked)}
        />
        Requer personalização
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={destaque}
          onChange={(e) => setDestaque(e.target.checked)}
        />
        Produto em destaque
      </label>

      <div className="border border-line rounded-lg p-4">
        <label className="flex items-center gap-2 text-sm mb-1">
          <input
            type="checkbox"
            checked={controlaEstoque}
            onChange={(e) => setControlaEstoque(e.target.checked)}
          />
          Controlar estoque
        </label>
        <p className="text-xs text-ink/50 mb-3">
          Desmarcado, o produto vende sem limite de unidades — igual sempre foi.
        </p>
        {controlaEstoque && (
          <Campo label="Unidades disponíveis">
            <input
              type="number"
              min="0"
              step="1"
              value={estoque}
              onChange={(e) => setEstoque(e.target.value)}
              className="w-32 border border-line rounded px-3 py-2 text-sm"
            />
          </Campo>
        )}
      </div>

      <div>
        <p className="text-sm font-medium mb-2">Variações</p>
        <div className="space-y-2">
          {variacoes.map((v, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={v.tipo}
                onChange={(e) => atualizarVariacao(i, "tipo", e.target.value)}
                placeholder="Tipo (ex: Tamanho)"
                className="w-1/3 border border-line rounded px-3 py-2 text-sm"
              />
              <input
                value={v.valores}
                onChange={(e) => atualizarVariacao(i, "valores", e.target.value)}
                placeholder="Valores separados por vírgula"
                className="flex-1 border border-line rounded px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => removerVariacao(i)}
                className="text-berry text-xs px-2"
              >
                Remover
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setVariacoes((prev) => [...prev, { tipo: "", valores: "" }])}
          className="text-pine text-xs mt-2 hover:underline"
        >
          + Adicionar variação
        </button>
      </div>

      <div className="border-t border-line pt-4">
        <p className="text-sm font-medium mb-1">Custo de material</p>
        <p className="text-xs text-ink/50 mb-3">
          Lance tudo que é gasto pra fazer o produto — assim dá pra ver a margem real, não só o
          preço de venda. Isso nunca aparece pro cliente, só aqui no admin.
        </p>
        <div className="space-y-2">
          {materiais.map((m, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                value={m.nome}
                onChange={(e) => atualizarMaterial(i, "nome", e.target.value)}
                placeholder="Material (ex: Caneca branca)"
                className="flex-1 border border-line rounded px-3 py-2 text-sm"
              />
              <input
                value={m.quantidade}
                onChange={(e) => atualizarMaterial(i, "quantidade", e.target.value)}
                placeholder="Qtd"
                inputMode="decimal"
                className="w-16 border border-line rounded px-2 py-2 text-sm"
              />
              <input
                value={m.custoUnitario}
                onChange={(e) => atualizarMaterial(i, "custoUnitario", e.target.value)}
                placeholder="Custo un."
                inputMode="decimal"
                className="w-24 border border-line rounded px-2 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => removerMaterial(i)}
                className="text-berry text-xs px-2"
              >
                Remover
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            setMateriais((prev) => [...prev, { nome: "", quantidade: "1", custoUnitario: "" }])
          }
          className="text-pine text-xs mt-2 hover:underline"
        >
          + Adicionar material
        </button>

        <div className="bg-paper-2 border border-line rounded-lg p-4 mt-4 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-ink/60">Custo total de material</span>
            <span className="font-mono">{reais(custoTotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink/60">Lucro por unidade</span>
            <span className={`font-mono ${lucro < 0 ? "text-berry" : "text-pine-2"}`}>
              {reais(lucro)}
            </span>
          </div>
          {margem !== null && (
            <div className="flex justify-between">
              <span className="text-ink/60">Margem</span>
              <span className={`font-mono ${lucro < 0 ? "text-berry" : "text-pine-2"}`}>
                {margem.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      </div>

      {erro && <p className="text-sm text-berry">{erro}</p>}

      <button
        type="submit"
        disabled={enviando || enviandoFoto || enviandoVideo}
        className="bg-pine text-white px-6 py-2.5 rounded-full text-sm disabled:opacity-50"
      >
        {enviando ? "Salvando..." : editando ? "Salvar alterações" : "Criar produto"}
      </button>

      <EditorFoto
        arquivo={arquivoParaEditar}
        aspecto={1}
        onCancelar={() => setArquivoParaEditar(null)}
        onConfirmar={enviarFotoEditada}
      />
    </form>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-ink/50 mb-1.5">{label}</span>
      {children}
    </label>
  );
}

