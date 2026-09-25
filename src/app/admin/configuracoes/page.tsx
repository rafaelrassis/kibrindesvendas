"use client";

import { useEffect, useState } from "react";
import AdminNav from "@/components/AdminNav";
import type { TransportadoraFrete } from "@prisma/client";
import type { ConfiguracaoLoja, CampoMargemShopee } from "@/lib/data/configuracao";

// Estado local de edição de um campo do template — valor em texto pra
// aceitar input livre (inclusive vazio), convertido pro payload ao salvar.
type CampoForm = {
  nome: string;
  tipo: CampoMargemShopee["tipo"];
  sinal: CampoMargemShopee["sinal"];
  valorPadrao: string;
};

// Number.toString() usa ponto; os campos de valor aqui só aceitam vírgula
// como decimal (padrão pt-BR).
function numParaTexto(n: number | null | undefined): string {
  return n != null ? n.toString().replace(".", ",") : "";
}

function comoDecimalBr(v: string): string {
  return v.replace(".", ",");
}

function paraCampoForm(c: CampoMargemShopee): CampoForm {
  return { nome: c.nome, tipo: c.tipo, sinal: c.sinal, valorPadrao: numParaTexto(c.valorPadrao) };
}

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const CAMPO_VAZIO: CampoForm = { nome: "", tipo: "percentual", sinal: "subtrai", valorPadrao: "" };

export default function AdminConfiguracoesPage() {
  const [config, setConfig] = useState<ConfiguracaoLoja | null>(null);
  const [cepOrigem, setCepOrigem] = useState("");
  const [transportadora, setTransportadora] = useState<TransportadoraFrete>("MELHOR_ENVIO");
  const [tokenMelhorEnvio, setTokenMelhorEnvio] = useState("");
  const [tokenSuperFrete, setTokenSuperFrete] = useState("");
  const [achatarFaixaPeso, setAchatarFaixaPeso] = useState(true);
  const [taxaGateway, setTaxaGateway] = useState("");
  const [campos, setCampos] = useState<CampoForm[]>([]);
  const [syncAtivo, setSyncAtivo] = useState(false);
  const [syncDias, setSyncDias] = useState<number[]>([]);
  const [syncHorarios, setSyncHorarios] = useState<string[]>([]);
  const [syncReposicao, setSyncReposicao] = useState("50");
  const [syncPausar, setSyncPausar] = useState(true);
  const [syncEmail, setSyncEmail] = useState("");
  const [syncManual, setSyncManual] = useState<string | null>(null);
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
        setAchatarFaixaPeso(c.freteAchataFaixaPeso);
        setTaxaGateway(numParaTexto(c.taxaGatewayPct));
        setCampos(c.camposMargemShopee.map(paraCampoForm));
        preencherSync(c);
      })
      .finally(() => setCarregando(false));
  }, []);

  function preencherSync(c: ConfiguracaoLoja) {
    setSyncAtivo(c.syncFornecedorAtivo);
    setSyncDias(c.syncFornecedorDias);
    setSyncHorarios(c.syncFornecedorHorarios);
    setSyncReposicao(String(c.syncFornecedorEstoqueReposicao));
    setSyncPausar(c.syncFornecedorPausarEsgotado);
    setSyncEmail(c.syncFornecedorEmailAlerta ?? "");
  }

  // Processa todos os produtos com link, em lotes: cada chamada cabe no
  // tempo da função serverless e devolve quantos ainda faltam.
  async function sincronizarTudo() {
    const desde = new Date().toISOString();
    let processados = 0;
    let erros = 0;
    setSyncManual("Sincronizando…");
    for (let i = 0; i < 50; i++) {
      const r = await fetch("/api/admin/fornecedor/sincronizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ desde }),
      });
      const data = await r.json();
      if (!r.ok) {
        setSyncManual(data.error ?? "Falha ao sincronizar.");
        return;
      }
      processados += data.resultados.length;
      erros += data.resultados.filter((x: { ok: boolean }) => !x.ok).length;
      if (data.pendentes === 0) break;
      setSyncManual(`Sincronizando… ${processados} feitos, ${data.pendentes} faltando.`);
    }
    setSyncManual(
      `Pronto: ${processados} produto(s) verificados${erros > 0 ? `, ${erros} com erro (veja o alerta no topo)` : ""}.`
    );
    window.dispatchEvent(new Event("alertas-fornecedor"));
  }

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
      freteAchataFaixaPeso: boolean;
      taxaGatewayPct: number | null;
      camposMargemShopee: CampoMargemShopee[];
      syncFornecedorAtivo: boolean;
      syncFornecedorDias: number[];
      syncFornecedorHorarios: string[];
      syncFornecedorEstoqueReposicao: number;
      syncFornecedorPausarEsgotado: boolean;
      syncFornecedorEmailAlerta: string | null;
    } = {
      cepOrigem,
      transportadoraAtiva: transportadora,
      freteAchataFaixaPeso: achatarFaixaPeso,
      taxaGatewayPct: taxaGateway.trim() ? Number(taxaGateway.replace(",", ".")) : null,
      camposMargemShopee: campos
        .filter((c) => c.nome.trim())
        .map((c) => ({
          nome: c.nome.trim(),
          tipo: c.tipo,
          sinal: c.sinal,
          valorPadrao: c.valorPadrao.trim() ? Number(c.valorPadrao.replace(",", ".")) : null,
        })),
      syncFornecedorAtivo: syncAtivo,
      syncFornecedorDias: syncDias,
      syncFornecedorHorarios: syncHorarios.filter(Boolean),
      syncFornecedorEstoqueReposicao: Math.round(Number(syncReposicao)),
      syncFornecedorPausarEsgotado: syncPausar,
      syncFornecedorEmailAlerta: syncEmail.trim() || null,
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
    preencherSync(data);
    setTokenMelhorEnvio("");
    setTokenSuperFrete("");
    setSucesso("Configurações salvas.");
  }

  if (carregando) return <p className="text-sm text-ink/50">Carregando…</p>;

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="font-display text-3xl mb-1">Configurações</h1>
      <p className="text-ink/60 mb-2 text-sm">
        Dados operacionais da loja, como o frete real pelos Correios.
      </p>
      <AdminNav />

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

          <label className="flex items-start gap-2 mt-4">
            <input
              type="checkbox"
              checked={achatarFaixaPeso}
              onChange={(e) => setAchatarFaixaPeso(e.target.checked)}
              className="mt-1"
            />
            <span className="text-sm text-ink/70">
              Achatar cotação SuperFrete por faixa de peso dos Correios
              <span className="block text-xs text-ink/50">
                Ligado: cobra sempre o valor do teto da faixa (até 300g, depois de 1 em 1kg) —
                pedidos com pesos diferentes na mesma faixa pagam o mesmo frete. Desligado: cota
                pelo peso real, contínuo.
              </span>
            </span>
          </label>
        </div>

        <div>
          <p className="text-sm font-medium mb-2">DRE — taxa do Mercado Pago</p>
          <p className="text-xs text-ink/50 mb-3">
            Percentual descontado de cada pedido do site. Cada pedido novo guarda a taxa
            vigente na hora da compra; mudar aqui não altera pedidos antigos.
          </p>
          <label className="block">
            <span className="text-sm text-ink/70">Taxa (%)</span>
            <input
              value={taxaGateway}
              onChange={(e) => setTaxaGateway(comoDecimalBr(e.target.value))}
              inputMode="decimal"
              placeholder="0,00"
              className="w-full border border-line rounded px-3 py-2 text-sm mt-1"
            />
          </label>
        </div>

        <div>
          <p className="text-sm font-medium mb-2">Vendas Shopee — campos do pedido</p>
          <p className="text-xs text-ink/50 mb-3">
            Template usado ao lançar uma venda em Vendas Shopee — espelhe os campos reais do
            pedido (Comissão, Frete, Ads, Renda estimada…). Cada lançamento guarda seu próprio
            valor; editar aqui não muda vendas já lançadas.
          </p>
          <div className="space-y-2">
            {campos.map((c, i) => (
              <div key={i} className="flex gap-1.5 items-start">
                <input
                  value={c.nome}
                  onChange={(e) =>
                    setCampos((cs) => cs.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))
                  }
                  placeholder="Nome do campo"
                  className="flex-1 border border-line rounded px-2 py-2 text-sm min-w-0"
                />
                <select
                  value={c.tipo}
                  onChange={(e) =>
                    setCampos((cs) =>
                      cs.map((x, j) =>
                        j === i ? { ...x, tipo: e.target.value as CampoMargemShopee["tipo"] } : x
                      )
                    )
                  }
                  className="border border-line rounded px-1.5 py-2 text-sm bg-white"
                >
                  <option value="percentual">%</option>
                  <option value="valor">R$</option>
                </select>
                <select
                  value={c.sinal}
                  onChange={(e) =>
                    setCampos((cs) =>
                      cs.map((x, j) =>
                        j === i ? { ...x, sinal: e.target.value as CampoMargemShopee["sinal"] } : x
                      )
                    )
                  }
                  className="border border-line rounded px-1.5 py-2 text-sm bg-white"
                >
                  <option value="subtrai">− lucro</option>
                  <option value="soma">+ lucro</option>
                </select>
                <input
                  inputMode="decimal"
                  value={c.valorPadrao}
                  onChange={(e) =>
                    setCampos((cs) =>
                      cs.map((x, j) =>
                        j === i ? { ...x, valorPadrao: comoDecimalBr(e.target.value) } : x
                      )
                    )
                  }
                  placeholder="valor padrão"
                  className="w-24 border border-line rounded px-2 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setCampos((cs) => cs.filter((_, j) => j !== i))}
                  className="px-2 py-2 text-sm border border-line rounded text-berry"
                  aria-label="Remover campo"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setCampos((cs) => [...cs, { ...CAMPO_VAZIO }])}
            className="mt-2 text-sm border border-line rounded px-3 py-1.5"
          >
            + Adicionar campo
          </button>

          <p className="text-xs text-ink/50 mt-3">
            Campos como aparecem no pedido real da Shopee (tela de detalhes do pedido, em{" "}
            <span className="italic">Informações de Pagamento</span>): <strong>Subtotal dos
            Produtos</strong> (já é o valor vendido, digitado no lançamento — não entra aqui),{" "}
            <strong>Subtotal estimado do frete</strong>, <strong>Cupons &amp; descontos</strong>,{" "}
            <strong>Taxas e Encargos</strong> — e o resultado, <strong>Renda estimada do
            pedido</strong>, é o que esta tela chama de lucro líquido (calculado, não é um
            campo pra cadastrar).
          </p>
        </div>

        <div>
          <p className="text-sm font-medium mb-2">Sincronização com fornecedor</p>
          <p className="text-xs text-ink/50 mb-3">
            Nos dias e horários abaixo (horário de Brasília), o sistema abre o link do
            fornecedor de cada produto, zera o estoque do que está indisponível lá e repõe o
            que voltou. Se algum link falhar, aparece um alerta vermelho no topo do painel.
          </p>
          <label className="flex items-center gap-2 text-sm mb-3">
            <input type="checkbox" checked={syncAtivo} onChange={(e) => setSyncAtivo(e.target.checked)} />
            Sincronização automática ligada
          </label>

          <p className="text-xs text-ink/60 mb-1">Dias</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {DIAS_SEMANA.map((rotulo, dia) => {
              const marcado = syncDias.includes(dia);
              return (
                <button
                  key={dia}
                  type="button"
                  onClick={() =>
                    setSyncDias((ds) => (marcado ? ds.filter((d) => d !== dia) : [...ds, dia]))
                  }
                  className={`px-3 py-1.5 text-sm rounded-full border ${
                    marcado ? "bg-pine text-white border-pine" : "border-line"
                  }`}
                >
                  {rotulo}
                </button>
              );
            })}
          </div>

          <p className="text-xs text-ink/60 mb-1">Horários</p>
          <div className="flex flex-wrap gap-2 mb-1">
            {syncHorarios.map((h, i) => (
              <div key={i} className="flex items-center gap-1">
                <input
                  type="time"
                  step={3600}
                  value={h}
                  onChange={(e) =>
                    setSyncHorarios((hs) => hs.map((x, j) => (j === i ? e.target.value : x)))
                  }
                  className="border border-line rounded px-2 py-1.5 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setSyncHorarios((hs) => hs.filter((_, j) => j !== i))}
                  className="px-2 py-1.5 text-sm border border-line rounded text-berry"
                  aria-label="Remover horário"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setSyncHorarios((hs) => [...hs, "08:00"])}
              className="text-sm border border-line rounded px-3 py-1.5"
            >
              + Horário
            </button>
          </div>
          <p className="text-xs text-ink/50 mb-3">
            O agendador passa de hora em hora — a sincronização pode começar até ~1h depois do
            horário escolhido.
          </p>

          <div className="grid sm:grid-cols-2 gap-3 mb-3">
            <label className="text-sm">
              <span className="block text-xs text-ink/60 mb-1">
                Estoque ao repor (quando o fornecedor não informa quantidade)
              </span>
              <input
                type="number"
                min={1}
                value={syncReposicao}
                onChange={(e) => setSyncReposicao(e.target.value)}
                className="w-full border border-line rounded px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm">
              <span className="block text-xs text-ink/60 mb-1">E-mail pra alerta de falha (opcional)</span>
              <input
                type="email"
                value={syncEmail}
                onChange={(e) => setSyncEmail(e.target.value)}
                placeholder="voce@exemplo.com"
                className="w-full border border-line rounded px-3 py-2 text-sm"
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm mb-3">
            <input type="checkbox" checked={syncPausar} onChange={(e) => setSyncPausar(e.target.checked)} />
            Pausar o produto quando tudo esgotar no fornecedor (e reativar quando voltar)
          </label>

          {config?.syncFornecedorUltimaExecucao && (
            <p className="text-xs text-ink/50 mb-2">
              Último ciclo agendado:{" "}
              {new Date(config.syncFornecedorUltimaExecucao).toLocaleString("pt-BR")}
              {config.syncFornecedorResumo &&
                ` — ${config.syncFornecedorResumo.total} produto(s), ${config.syncFornecedorResumo.erros} com erro`}
            </p>
          )}
          <button
            type="button"
            onClick={sincronizarTudo}
            disabled={syncManual === "Sincronizando…" || !!syncManual?.includes("faltando")}
            className="text-sm border border-line rounded px-3 py-1.5 disabled:opacity-50"
          >
            Sincronizar tudo agora
          </button>
          {syncManual && <p className="text-sm text-ink/70 mt-2">{syncManual}</p>}
        </div>

        <div>
          <p className="text-sm font-medium mb-2">Tamanho dos banners da home</p>
          <p className="text-xs text-ink/50 mb-3">
            Pra criar a arte (Canva etc.). Milímetros convertidos a 96 dpi — os mesmos pixels
            pedidos em Banners.
          </p>
          <ul className="text-sm text-ink/70 space-y-1">
            <li>📱 Celular: <strong>164 × 85 mm</strong> (620 × 320 px)</li>
            <li>🖥️ PC: <strong>588 × 110 mm</strong> (2224 × 416 px)</li>
          </ul>
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
