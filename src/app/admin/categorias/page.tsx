"use client";

import { useEffect, useState } from "react";
import AdminNav from "@/components/AdminNav";

type Categoria = { slug: string; label: string; imagemUrl: string | null };

export default function AdminCategoriasPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [emEdicao, setEmEdicao] = useState<string | null>(null);
  const [form, setForm] = useState<{ label: string; imagemUrl: string | null }>({
    label: "",
    imagemUrl: null,
  });
  const [enviandoImagem, setEnviandoImagem] = useState(false);

  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    fetch("/api/categorias")
      .then((r) => r.json())
      .then(setCategorias);
  }, []);

  const iniciarNovo = () => {
    setEmEdicao("__novo__");
    setForm({ label: "", imagemUrl: null });
  };

  const iniciarEdicao = (c: Categoria) => {
    setEmEdicao(c.slug);
    setForm({ label: c.label, imagemUrl: c.imagemUrl });
  };

  const cancelar = () => {
    setEmEdicao(null);
    setForm({ label: "", imagemUrl: null });
  };

  // A imagem sobe na hora e o formulário guarda só a URL que o servidor
  // devolveu — igual ao banner da home.
  const selecionarImagem = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    setErro("");
    setEnviandoImagem(true);
    const dados = new FormData();
    dados.append("arquivo", arquivo);
    try {
      const r = await fetch("/api/admin/imagens", { method: "POST", body: dados });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Não foi possível enviar a imagem.");
      setForm((f) => ({ ...f, imagemUrl: data.url }));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar a imagem.");
    } finally {
      setEnviandoImagem(false);
    }
  };

  const salvar = async () => {
    if (!form.label.trim()) return;
    setErro("");
    setSalvando(true);

    try {
      if (emEdicao === "__novo__") {
        const r = await fetch("/api/admin/categorias", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const nova = await r.json();
        if (!r.ok) throw new Error(nova.error);
        setCategorias((prev) => [...prev, nova]);
      } else if (emEdicao) {
        const r = await fetch(`/api/admin/categorias/${emEdicao}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const atualizada = await r.json();
        if (!r.ok) throw new Error(atualizada.error);
        setCategorias((prev) => prev.map((c) => (c.slug === emEdicao ? atualizada : c)));
      }
      cancelar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  };

  const remover = async (slug: string) => {
    setErro("");
    const r = await fetch(`/api/admin/categorias/${slug}`, { method: "DELETE" });
    const data = await r.json();
    if (!r.ok) {
      setErro(data.error ?? "Não foi possível remover.");
      return;
    }
    setCategorias((prev) => prev.filter((c) => c.slug !== slug));
    if (emEdicao === slug) cancelar();
  };

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="font-display text-3xl mb-1">Categorias</h1>
      <p className="text-ink/60 mb-2 text-sm">
        Área interna — alterações são gravadas direto no banco.
      </p>
      {erro && <p className="text-sm text-berry mb-4">{erro}</p>}
      <AdminNav />

      <div className="bg-white border border-line rounded-lg overflow-x-auto mb-6">
        <table className="w-full text-sm min-w-[420px]">
          <thead className="bg-paper-2 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Imagem</th>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Slug</th>
              <th className="px-4 py-3 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {categorias.map((c) => (
              <tr key={c.slug} className="border-t border-line">
                {emEdicao === c.slug ? (
                  <td colSpan={4} className="px-4 py-3">
                    <LinhaEdicao
                      form={form}
                      setForm={setForm}
                      enviandoImagem={enviandoImagem}
                      selecionarImagem={selecionarImagem}
                      salvar={salvar}
                      cancelar={cancelar}
                      salvando={salvando}
                      rotuloSalvar="Salvar"
                    />
                  </td>
                ) : (
                  <>
                    <td className="px-4 py-3">
                      <IconeCategoria imagemUrl={c.imagemUrl} tamanho={36} />
                    </td>
                    <td className="px-4 py-3">{c.label}</td>
                    <td className="px-4 py-3 text-ink/50 font-mono text-xs">{c.slug}</td>
                    <td className="px-4 py-3 text-right space-x-3">
                      <button
                        onClick={() => iniciarEdicao(c)}
                        className="text-pine hover:underline text-xs"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => remover(c.slug)}
                        className="text-berry hover:underline text-xs"
                      >
                        Remover
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}

            {emEdicao === "__novo__" && (
              <tr className="border-t border-line">
                <td colSpan={4} className="px-4 py-3">
                  <LinhaEdicao
                    form={form}
                    setForm={setForm}
                    enviandoImagem={enviandoImagem}
                    selecionarImagem={selecionarImagem}
                    salvar={salvar}
                    cancelar={cancelar}
                    salvando={salvando}
                    rotuloSalvar="Adicionar"
                    autoFocus
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {emEdicao !== "__novo__" && (
        <button
          onClick={iniciarNovo}
          className="bg-pine text-white px-5 py-2.5 rounded-full text-sm hover:brightness-110 transition"
        >
          + Nova categoria
        </button>
      )}
    </div>
  );
}

// Ícone genérico exibido quando a categoria ainda não tem imagem cadastrada.
function IconeCategoria({ imagemUrl, tamanho }: { imagemUrl: string | null; tamanho: number }) {
  if (imagemUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imagemUrl}
        alt=""
        width={tamanho}
        height={tamanho}
        className="rounded object-cover"
        style={{ width: tamanho, height: tamanho }}
      />
    );
  }
  return (
    <div
      className="rounded bg-paper-2 border border-line flex items-center justify-center text-ink/30"
      style={{ width: tamanho, height: tamanho }}
    >
      🎁
    </div>
  );
}

function LinhaEdicao({
  form,
  setForm,
  enviandoImagem,
  selecionarImagem,
  salvar,
  cancelar,
  salvando,
  rotuloSalvar,
  autoFocus,
}: {
  form: { label: string; imagemUrl: string | null };
  setForm: React.Dispatch<React.SetStateAction<{ label: string; imagemUrl: string | null }>>;
  enviandoImagem: boolean;
  selecionarImagem: (arquivo: File | undefined) => void;
  salvar: () => void;
  cancelar: () => void;
  salvando: boolean;
  rotuloSalvar: string;
  autoFocus?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <IconeCategoria imagemUrl={form.imagemUrl} tamanho={40} />
      <label className="text-xs text-pine hover:underline cursor-pointer">
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          disabled={enviandoImagem}
          onChange={(e) => selecionarImagem(e.target.files?.[0])}
        />
        {enviandoImagem ? "Enviando..." : form.imagemUrl ? "Trocar" : "Enviar imagem"}
      </label>
      <input
        autoFocus={autoFocus}
        value={form.label}
        onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
        className="flex-1 min-w-[160px] border border-line rounded px-2 py-1.5"
        placeholder="Nome da categoria"
      />
      <button
        onClick={salvar}
        disabled={salvando || enviandoImagem}
        className="bg-pine text-white px-3 py-1.5 rounded-full text-xs disabled:opacity-50"
      >
        {salvando ? "Salvando..." : rotuloSalvar}
      </button>
      <button onClick={cancelar} className="border border-line px-3 py-1.5 rounded-full text-xs">
        Cancelar
      </button>
    </div>
  );
}
