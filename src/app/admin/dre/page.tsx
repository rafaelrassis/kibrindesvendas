import AdminNav from "@/components/AdminNav";
import AdminDreDespesas from "@/components/AdminDreDespesas";
import AdminDreImprimir from "@/components/AdminDreImprimir";
import { exigirAdmin } from "@/lib/admin";
import { getDRE } from "@/lib/data/dre";
import { CANAIS_DRE, LABEL_CANAL, canalValido, ultimosMeses } from "@/lib/dre";

const reais = (n: number) =>
  (n === 0 ? 0 : n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (n: number) => `${n.toFixed(1).replace(".", ",")}%`;

export default async function AdminDrePage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; canal?: string }>;
}) {
  await exigirAdmin();
  const params = await searchParams;
  const canal = canalValido(params.canal);
  const { mes, rotulo, dre, despesas, itensSemSnapshotDeCusto } = await getDRE(params.mes, canal);

  // Garante que o mês da URL aparece no select mesmo fora dos últimos 12.
  const meses = ultimosMeses(12);
  if (!meses.some((m) => m.mes === mes)) meses.push({ mes, rotulo });

  const avisos: string[] = [];
  if (dre.pedidosSemFreteCusto > 0 && canal !== "shopee") {
    avisos.push(
      `${dre.pedidosSemFreteCusto} pedido(s) sem custo da etiqueta lançado em Pedidos — o resultado está maior do que o real.`
    );
  }
  if (itensSemSnapshotDeCusto > 0) {
    avisos.push(
      `${itensSemSnapshotDeCusto} item(ns) de pedidos antigos usam o custo atual do produto, não o da época da venda.`
    );
  }
  if (canal !== "todos") {
    avisos.push("Despesas operacionais só entram na visão Site + Shopee.");
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="font-display text-3xl mb-1">DRE</h1>
      <p className="text-ink/60 text-sm mb-2">
        Demonstrativo do resultado por mês de criação do pedido. Só pedido pago e com cobrança
        real entra; simulado, aguardando pagamento e cancelado ficam de fora.
      </p>
      <div className="print:hidden">
        <AdminNav />
      </div>

      <form method="get" className="flex flex-wrap gap-2 mb-4 print:hidden">
        <select
          name="mes"
          defaultValue={mes}
          aria-label="Mês"
          className="border border-line rounded px-3 py-2 text-sm bg-white"
        >
          {meses.map((m) => (
            <option key={m.mes} value={m.mes}>
              {m.rotulo}
            </option>
          ))}
        </select>
        <select
          name="canal"
          defaultValue={canal}
          aria-label="Canal"
          className="border border-line rounded px-3 py-2 text-sm bg-white"
        >
          {CANAIS_DRE.map((c) => (
            <option key={c} value={c}>
              {LABEL_CANAL[c]}
            </option>
          ))}
        </select>
        <button type="submit" className="px-4 py-2 rounded bg-pine text-white text-sm">
          Gerar
        </button>
        <a
          href={`/api/admin/dre/csv?mes=${mes}&canal=${canal}`}
          className="px-3 py-2 rounded border border-line bg-white text-sm"
        >
          Exportar CSV
        </a>
        <AdminDreImprimir />
      </form>

      <p className="text-sm font-medium mb-2">
        {rotulo} · {LABEL_CANAL[canal]}
      </p>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <Cartao label="Resultado" valor={reais(dre.resultado)} alerta={dre.resultado < 0} />
        <Cartao label="Margem líquida" valor={pct(dre.margemPct)} alerta={dre.margemPct < 0} />
      </div>

      {avisos.length > 0 && (
        <ul className="mb-4 space-y-1">
          {avisos.map((a) => (
            <li key={a} className="text-xs text-ink/60 bg-mustard/15 rounded px-3 py-2">
              {a}
            </li>
          ))}
        </ul>
      )}

      <div className="bg-white border border-line rounded-lg px-4 py-1 text-sm mb-4">
        <Linha titulo="Receita bruta" valor={dre.receitaBruta} total />
        <Linha titulo={`Site (${dre.pedidosSite} pedidos)`} valor={dre.receitaSite} sub />
        <Linha titulo={`Shopee (${dre.vendasShopee} vendas)`} valor={dre.receitaShopee} sub />
        <Linha titulo="Frete cobrado" valor={dre.freteCobrado} sub />
        <Linha titulo="(-) Cupons" valor={-dre.cupons} />
        <Linha titulo="(-) Devoluções" valor={-dre.devolucoes} />
        <Linha titulo="Receita líquida" valor={dre.receitaLiquida} total />
        <Linha titulo="(-) Custo de material" valor={-dre.custoMaterial} />
        <Linha titulo="Lucro bruto" valor={dre.lucroBruto} total />
        <Linha titulo="(-) Taxas Mercado Pago" valor={-dre.taxasGateway} />
        <Linha titulo="(-) Taxas Shopee" valor={-dre.taxasShopee} />
        <Linha titulo="(-) Frete pago (etiquetas)" valor={-dre.fretePago} />
        <Linha titulo="(-) Despesas operacionais" valor={-dre.despesas} />
        <Linha titulo="Resultado do período" valor={dre.resultado} total destaque />
      </div>

      {canal === "todos" && <AdminDreDespesas despesas={despesas} mes={mes} />}
    </div>
  );
}

function Cartao({ label, valor, alerta }: { label: string; valor: string; alerta?: boolean }) {
  return (
    <div className="bg-white border border-line rounded-lg p-4">
      <p className="text-xs text-ink/50 mb-1">{label}</p>
      <p className={`font-mono text-lg font-medium ${alerta ? "text-berry" : ""}`}>{valor}</p>
    </div>
  );
}

function Linha({
  titulo,
  valor,
  total,
  sub,
  destaque,
}: {
  titulo: string;
  valor: number;
  total?: boolean;
  sub?: boolean;
  destaque?: boolean;
}) {
  return (
    <div
      className={`flex justify-between py-2 border-b border-line/60 last:border-0 ${
        total ? "font-medium" : ""
      } ${sub ? "pl-4 text-ink/60 text-xs" : ""} ${destaque ? "text-base" : ""}`}
    >
      <span>{titulo}</span>
      <span className={`font-mono ${valor < 0 ? "text-berry" : ""}`}>{reais(valor)}</span>
    </div>
  );
}
