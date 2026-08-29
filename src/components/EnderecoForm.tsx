"use client";

import { useEffect, useState } from "react";
import type { Endereco } from "@/lib/conta-data";
import { formatarCep, normalizarCep } from "@/lib/frete";

type Props = {
  inicial: Endereco;
  onSalvar: (endereco: Endereco) => void | Promise<void>;
  onExcluir?: () => void;
};

export default function EnderecoForm({ inicial, onSalvar, onExcluir }: Props) {
  const [form, setForm] = useState<Endereco>(inicial);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [erroCep, setErroCep] = useState("");
  const [erroSalvar, setErroSalvar] = useState("");
  const [salvando, setSalvando] = useState(false);

  function campo<K extends keyof Endereco>(chave: K, valor: Endereco[K]) {
    setForm((f) => ({ ...f, [chave]: valor }));
  }

  // CEP completo preenche rua/bairro/cidade/UF sozinho; o que o cliente digitou
  // antes não é sobrescrito por campo vazio do ViaCEP (endereço sem logradouro).
  function preencherPeloCep(valor: string) {
    const cep = normalizarCep(valor);
    setErroCep("");
    if (!cep) return;

    setBuscandoCep(true);
    fetch(`/api/cep/${cep}`)
      .then(async (r) => {
        const dados = await r.json();
        if (!r.ok) {
          setErroCep(dados.error ?? "Não foi possível consultar o CEP.");
          return;
        }
        setForm((f) => ({
          ...f,
          rua: dados.logradouro || f.rua,
          bairro: dados.bairro || f.bairro,
          cidade: dados.cidade || f.cidade,
          uf: dados.uf || f.uf,
        }));
      })
      .catch(() => setErroCep("Não foi possível consultar o CEP agora."))
      .finally(() => setBuscandoCep(false));
  }

  // Form abre com CEP já preenchido (veio da busca na página do produto) mas
  // sem rua/bairro/cidade/UF: busca automaticamente, já que o preenchimento
  // do input normalmente só dispara no onChange do próprio campo CEP.
  useEffect(() => {
    if (inicial.cep && !inicial.rua) {
      // Empurra pro próximo tick: setState síncrono direto no corpo do
      // efeito dispara o lint react-hooks/set-state-in-effect.
      queueMicrotask(() => preencherPeloCep(inicial.cep));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setErroSalvar("");
        setSalvando(true);
        try {
          await onSalvar(form);
        } catch (err) {
          setErroSalvar(err instanceof Error ? err.message : "Não foi possível salvar.");
        } finally {
          setSalvando(false);
        }
      }}
      className="space-y-4"
    >
      <Campo label="Identificação (ex: Casa, Trabalho)">
        <input
          value={form.rotulo}
          onChange={(e) => campo("rotulo", e.target.value)}
          className="w-full bg-white border border-line rounded-lg px-4 py-3 text-sm outline-none focus:border-pine"
          required
        />
      </Campo>

      <Campo label="Destinatário">
        <input
          value={form.destinatario}
          onChange={(e) => campo("destinatario", e.target.value)}
          className="w-full bg-white border border-line rounded-lg px-4 py-3 text-sm outline-none focus:border-pine"
          required
        />
      </Campo>

      <div className="grid grid-cols-2 gap-3">
        <Campo label={buscandoCep ? "CEP (buscando...)" : "CEP"}>
          <input
            value={form.cep}
            inputMode="numeric"
            maxLength={9}
            placeholder="00000-000"
            onChange={(e) => {
              campo("cep", formatarCep(e.target.value));
              preencherPeloCep(e.target.value);
            }}
            className="w-full bg-white border border-line rounded-lg px-4 py-3 text-sm outline-none focus:border-pine"
            required
          />
        </Campo>
        <Campo label="Número">
          <input
            value={form.numero}
            onChange={(e) => campo("numero", e.target.value)}
            className="w-full bg-white border border-line rounded-lg px-4 py-3 text-sm outline-none focus:border-pine"
            required
          />
        </Campo>
      </div>

      {erroCep && <p className="text-xs text-berry -mt-2">{erroCep}</p>}

      <Campo label="Rua">
        <input
          value={form.rua}
          onChange={(e) => campo("rua", e.target.value)}
          className="w-full bg-white border border-line rounded-lg px-4 py-3 text-sm outline-none focus:border-pine"
          required
        />
      </Campo>

      <Campo label="Complemento (opcional)">
        <input
          value={form.complemento}
          onChange={(e) => campo("complemento", e.target.value)}
          className="w-full bg-white border border-line rounded-lg px-4 py-3 text-sm outline-none focus:border-pine"
        />
      </Campo>

      <Campo label="Bairro">
        <input
          value={form.bairro}
          onChange={(e) => campo("bairro", e.target.value)}
          className="w-full bg-white border border-line rounded-lg px-4 py-3 text-sm outline-none focus:border-pine"
          required
        />
      </Campo>

      <div className="grid grid-cols-[1fr_100px] gap-3">
        <Campo label="Cidade">
          <input
            value={form.cidade}
            onChange={(e) => campo("cidade", e.target.value)}
            className="w-full bg-white border border-line rounded-lg px-4 py-3 text-sm outline-none focus:border-pine"
            required
          />
        </Campo>
        <Campo label="UF">
          <input
            value={form.uf}
            maxLength={2}
            onChange={(e) => campo("uf", e.target.value.toUpperCase())}
            className="w-full bg-white border border-line rounded-lg px-4 py-3 text-sm outline-none focus:border-pine uppercase"
            required
          />
        </Campo>
      </div>

      <label className="flex items-center gap-2.5 text-sm pt-1">
        <input
          type="checkbox"
          checked={form.padrao}
          onChange={(e) => campo("padrao", e.target.checked)}
          className="w-4 h-4 accent-pine"
        />
        Usar como endereço padrão
      </label>

      {erroSalvar && <p className="text-xs text-berry -mt-2">{erroSalvar}</p>}

      <button
        type="submit"
        disabled={salvando}
        className="w-full bg-pine text-paper py-3.5 rounded-full text-sm mt-2 disabled:opacity-60"
      >
        {salvando ? "Salvando..." : "Salvar endereço"}
      </button>

      {onExcluir && (
        <button
          type="button"
          onClick={onExcluir}
          className="w-full text-berry text-sm py-2"
        >
          Excluir endereço
        </button>
      )}
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
