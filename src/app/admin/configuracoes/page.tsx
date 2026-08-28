"use client";

import { useEffect, useState } from "react";
import AdminNav from "@/components/AdminNav";
import type { TransportadoraFrete } from "@prisma/client";
import type { ConfiguracaoLoja } from "@/lib/data/configuracao";

export default function AdminConfiguracoesPage() {
  const [config, setConfig] = useState<ConfiguracaoLoja | null>(null);
  const [cepOrigem, setCepOrigem] = useState("");
  const [transportadora, setTransportadora] = useState<TransportadoraFrete>("MELHOR_ENVIO");
  const [tokenMelhorEnvio, setTokenMelhorEnvio] = useState("");
  const [tokenSuperFrete, setTokenSuperFrete] = useState("");
  const [shopeeComissaoPct, setShopeeComissaoPct] = useState("");
  const [shopeeFretePct, setShopeeFretePct] = useState("");
  const [shopeeAdsPct, setShopeeAdsPct] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  useEffect(() => {
    fetch("/api/admin/configuracoes")
      .then((r) => r.json())
      .then((c: ConfiguracaoLoja) => {
        setConfig(c);
        setCepOrigem(c.cepOrigem);
        setTransportadora(c.transportadoraAtiva);
        setShopeeComissaoPct(c.shopeeComissaoPct?.toString() ?? "");
        setShopeeFretePct(c.shopeeFretePct?.toString() ?? "");
        setShopeeAdsPct(c.shopeeAdsPct?.toString() ?? "");
      })
      .finally(() => setCarregando(false));
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setSucesso("");
    setSalvando(true);

    const payload: {
      cepOrigem: string;
      transportadoraAtiva: TransportadoraFrete;
      melhorEnvioToken?: string;
      superFreteToken?: string;
      shopeeComissaoPct: number | null;
      shopeeFretePct: number | null;
      shopeeAdsPct: number | null;
    } = {
      cepOrigem,
      transportadoraAtiva: transportadora,
      shopeeComissaoPct: shopeeComissaoPct.trim() ? Number(shopeeComissaoPct) : null,
      shopeeFretePct: shopeeFretePct.trim() ? Number(shopeeFretePct) : null,
      shopeeAdsPct: shopeeAdsPct.trim() ? Number(shopeeAdsPct) : null,
    };
    // Só manda o token se o admin digitou algo novo — campo vazio não apaga
    // por engano um token já cadastrado.
    if (tokenMelhorEnvio.trim()) payload.melhorEnvioToken = tokenMelhorEnvio.trim();
    if (tokenSuperFrete.trim()) payload.superFreteToken = tokenSuperFrete.trim();

    const r = await fetch("/api/admin/configuracoes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await r.json();
    setSalvando(false);

    if (!r.ok) {
      setErro(data.error ?? "Não foi possível salvar.");
      return;
    }
    setConfig(data);
    setTokenMelhorEnvio("");
    setTokenSuperFrete("");
    setSucesso("Configurações salvas.");
  }

  if (carregando) return <p className="text-sm text-ink/50">Carregando…</p>;

  return (
    <div>
      <AdminNav />
      <h1 className="font-display text-2xl mb-1">Configurações</h1>
      <p className="text-sm text-ink/60 mb-6">
        Dados operacionais da loja, como o frete real pelos Correios.
      </p>

      <form onSubmit={salvar} className="max-w-md space-y-5">
        <div>
          <p className="text-sm font-medium mb-2">Frete real</p>
          <p className="text-xs text-ink/50 mb-3">
            Cotação de PAC/SEDEX pelos Correios, via Melhor Envio ou SuperFrete. Só a
            transportadora ativa é consultada no checkout — a outra pode ficar com token
            cadastrado, sem uso, pra trocar depois sem digitar tudo de novo. Sem token
            configurado na ativa, o site usa uma estimativa por região.
          </p>

          <label className="block mb-3">
            <span className="text-sm text-ink/70">CEP de origem (de onde a loja despacha)</span>
            <input
              value={cepOrigem}
              onChange={(e) => setCepOrigem(e.target.value)}
              placeholder="00000-000"
              className="w-full border border-line rounded px-3 py-2 text-sm mt-1"
            />
          </label>

          <label className="block mb-4">
            <span className="text-sm text-ink/70">Transportadora ativa</span>
            <select
              value={transportadora}
              onChange={(e) => setTransportadora(e.target.value as TransportadoraFrete)}
              className="w-full border border-line rounded px-3 py-2 text-sm mt-1 bg-white"
            >
              <option value="MELHOR_ENVIO">Melhor Envio</option>
              <option value="SUPER_FRETE">SuperFrete</option>
            </select>
          </label>

          <label className="block mb-3">
            <span className="text-sm text-ink/70">
              Token de API do Melhor Envio
              {config?.melhorEnvioTokenConfigurado && (
                <span className="text-ink/40">
                  {" "}
                  (cadastrado, termina em ****{config.melhorEnvioTokenFinal})
                </span>
              )}
            </span>
            <input
              type="password"
              value={tokenMelhorEnvio}
              onChange={(e) => setTokenMelhorEnvio(e.target.value)}
              placeholder={
                config?.melhorEnvioTokenConfigurado
                  ? "Deixe em branco para manter o atual"
                  : "Cole aqui o token gerado no Melhor Envio"
              }
              className="w-full border border-line rounded px-3 py-2 text-sm mt-1"
            />
          </label>

          <label className="block">
            <span className="text-sm text-ink/70">
              Token de API do SuperFrete
              {config?.superFreteTokenConfigurado && (
                <span className="text-ink/40">
                  {" "}
                  (cadastrado, termina em ****{config.superFreteTokenFinal})
                </span>
              )}
            </span>
            <input
              type="password"
              value={tokenSuperFrete}
              onChange={(e) => setTokenSuperFrete(e.target.value)}
              placeholder={
                config?.superFreteTokenConfigurado
                  ? "Deixe em branco para manter o atual"
                  : "Cole aqui o token gerado no SuperFrete"
              }
              className="w-full border border-line rounded px-3 py-2 text-sm mt-1"
            />
          </label>
        </div>

        <div>
          <p className="text-sm font-medium mb-2">Vendas Shopee — margens padrão</p>
          <p className="text-xs text-ink/50 mb-3">
            Usadas ao lançar uma venda em Vendas Shopee, quando o produto não tem margem
            própria definida no cadastro. Em branco = 0%.
          </p>
          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className="text-sm text-ink/70">Comissão %</span>
              <input
                type="number"
                step="0.01"
                value={shopeeComissaoPct}
                onChange={(e) => setShopeeComissaoPct(e.target.value)}
                className="w-full border border-line rounded px-3 py-2 text-sm mt-1"
              />
            </label>
            <label className="block">
              <span className="text-sm text-ink/70">Frete %</span>
              <input
                type="number"
                step="0.01"
                value={shopeeFretePct}
                onChange={(e) => setShopeeFretePct(e.target.value)}
                className="w-full border border-line rounded px-3 py-2 text-sm mt-1"
              />
            </label>
            <label className="block">
              <span className="text-sm text-ink/70">Ads %</span>
              <input
                type="number"
                step="0.01"
                value={shopeeAdsPct}
                onChange={(e) => setShopeeAdsPct(e.target.value)}
                className="w-full border border-line rounded px-3 py-2 text-sm mt-1"
              />
            </label>
          </div>
        </div>

        {erro && <p className="text-sm text-berry">{erro}</p>}
        {sucesso && <p className="text-sm text-pine-2">{sucesso}</p>}

        <button
          type="submit"
          disabled={salvando}
          className="bg-pine text-white rounded-full px-6 py-2.5 text-sm font-medium disabled:opacity-50"
        >
          {salvando ? "Salvando…" : "Salvar"}
        </button>
      </form>
    </div>
  );
}
