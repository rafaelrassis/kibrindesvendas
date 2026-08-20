"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Cupom } from "@/lib/types";

// input datetime-local não aceita ISO com timezone; corta pro formato que ele
// entende e ignora horário — cupom expira no fim do dia escolhido.
function paraDataInput(iso: string | null) {
  return iso ? iso.slice(0, 10) : "";
}

export default function AdminCupomForm({ cupom }: { cupom?: Cupom }) {
  const router = useRouter();
  const editando = !!cupom;

  const [codigo, setCodigo] = useState(cupom?.codigo ?? "");
  const [tipo, setTipo] = useState<"PERCENTUAL" | "FIXO" | "FRETE_GRATIS">(
    cupom?.tipo ?? "PERCENTUAL"
  );
  const [valor, setValor] = useState(cupom?.valor?.toString() ?? "");
  const [ativo, setAtivo] = useState(cupom?.ativo ?? true);
  const [validoAte, setValidoAte] = useState(paraDataInput(cupom?.validoAte ?? null));
  const [usoMaximo, setUsoMaximo] = useState(cupom?.usoMaximo?.toString() ?? "");
  const [valorMinimoPedido, setValorMinimoPedido] = useState(
    cupom?.valorMinimoPedido ? cupom.valorMinimoPedido.toString() : ""
  );
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");

    if (!codigo.trim() || (tipo !== "FRETE_GRATIS" && !valor)) {
      setErro("Preencha o código e o valor do desconto.");
      return;
    }

    const payload = {
      codigo,
      tipo,
      valor: tipo === "FRETE_GRATIS" ? 0 : Number(valor),
      ativo,
      validoAte: validoAte || null,
      usoMaximo: usoMaximo ? Number(usoMaximo) : null,
      valorMinimoPedido: valorMinimoPedido ? Number(valorMinimoPedido) : 0,
    };

    setEnviando(true);
    const r = await fetch(editando ? `/api/admin/cupons/${cupom!.id}` : "/api/admin/cupons", {
      method: editando ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await r.json();
    setEnviando(false);

    if (!r.ok) {
      setErro(data.error ?? "Não foi possível salvar.");
      return;
    }
    router.push("/admin/cupons");
  }

  return (
    <form onSubmit={enviar} className="space-y-4 max-w-md">
      <Campo label="Código">
        <input
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.toUpperCase())}
          placeholder="ex: BEMVINDO10"
          className="w-full border border-line rounded px-3 py-2 text-sm font-mono uppercase"
          required
        />
      </Campo>

      <div className="grid grid-cols-2 gap-4">
        <Campo label="Tipo">
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as "PERCENTUAL" | "FIXO" | "FRETE_GRATIS")}
            className="w-full border border-line rounded px-3 py-2 text-sm"
          >
            <option value="PERCENTUAL">Percentual (%)</option>
            <option value="FIXO">Valor fixo (R$)</option>
            <option value="FRETE_GRATIS">Frete grátis</option>
          </select>
        </Campo>
        {tipo === "FRETE_GRATIS" ? (
          <Campo label="Desconto">
            <div className="w-full border border-line rounded px-3 py-2 text-sm text-ink/40 bg-paper-2">
              Frete zerado
            </div>
          </Campo>
        ) : (
          <Campo label={tipo === "PERCENTUAL" ? "Desconto (%)" : "Desconto (R$)"}>
            <input
              type="number"
              step="0.01"
              min="0"
              max={tipo === "PERCENTUAL" ? 100 : undefined}
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className="w-full border border-line rounded px-3 py-2 text-sm"
              required
            />
          </Campo>
        )}
      </div>
      {tipo === "FRETE_GRATIS" && (
        <p className="text-xs text-ink/50 -mt-2">
          O cliente paga só o produto — o frete some do total, não importa o valor do pedido.
          Pra frete grátis automático acima de um valor, sem precisar de código, veja o bloco no
          topo da lista de cupons.
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Campo label="Válido até (opcional)">
          <input
            type="date"
            value={validoAte}
            onChange={(e) => setValidoAte(e.target.value)}
            className="w-full border border-line rounded px-3 py-2 text-sm"
          />
        </Campo>
        <Campo label="Limite de usos (opcional)">
          <input
            type="number"
            min="1"
            value={usoMaximo}
            onChange={(e) => setUsoMaximo(e.target.value)}
            placeholder="sem limite"
            className="w-full border border-line rounded px-3 py-2 text-sm"
          />
        </Campo>
      </div>

      <Campo label="Pedido mínimo (opcional)">
        <input
          type="number"
          step="0.01"
          min="0"
          value={valorMinimoPedido}
          onChange={(e) => setValorMinimoPedido(e.target.value)}
          placeholder="0,00"
          className="w-full border border-line rounded px-3 py-2 text-sm"
        />
      </Campo>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
        Cupom ativo
      </label>

      {erro && <p className="text-sm text-berry">{erro}</p>}

      <button
        type="submit"
        disabled={enviando}
        className="bg-pine text-white px-6 py-2.5 rounded-full text-sm disabled:opacity-50"
      >
        {enviando ? "Salvando..." : editando ? "Salvar alterações" : "Criar cupom"}
      </button>
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
