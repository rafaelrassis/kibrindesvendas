import AdminNav from "@/components/AdminNav";
import {
  GraficoCanal,
  GraficoFrete,
  GraficoProdutos,
  GraficoStatus,
  GraficoVendas,
} from "@/components/AdminDashboardCharts";
import { exigirAdmin } from "@/lib/admin";
import { getDadosDoPainel } from "@/lib/data/dashboard";

export default async function AdminPainelPage() {
  await exigirAdmin();
  const {
    vendasPorDia,
    pedidosPorStatus,
    produtosMaisVendidos,
    vendasPorFrete,
    estoqueBaixo,
    vendasPorCanal,
    cuponsMaisUsados,
    resumo,
  } = await getDadosDoPainel();

  const semVendas = resumo.totalPedidos === 0;

  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      <h1 className="font-display text-3xl mb-1">Painel</h1>
      <p className="text-ink/60 text-sm mb-2">
        Últimos 30 dias. Pedido só entra no faturamento depois de pago —
        aguardando pagamento e cancelado ficam de fora.
      </p>
      <AdminNav />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <Cartao label="Vendas" valor={reais(resumo.totalVendas)} />
        <Cartao label="Pedidos pagos" valor={String(resumo.totalPedidos)} />
        <Cartao label="Ticket médio" valor={reais(resumo.ticketMedio)} />
        <Cartao
          label="Devoluções"
          valor={`${resumo.totalDevolucoes} (${resumo.taxaDevolucao.toFixed(1).replace(".", ",")}%)`}
          alerta={resumo.taxaDevolucao > 10}
        />
        <Cartao
          label="Lucro estimado"
          valor={`${reais(resumo.lucroEstimado)} (${resumo.margemPct.toFixed(0)}%)`}
          alerta={resumo.margemPct < 20 && resumo.totalPedidos > 0}
        />
        <Cartao label="Desconto em cupons" valor={reais(resumo.descontoTotalConcedido)} />
      </div>

      <Bloco titulo="Vendas por dia">
        {semVendas ? <Vazio texto="Nenhuma venda no período." /> : <GraficoVendas dados={vendasPorDia} />}
      </Bloco>

      <div className="grid md:grid-cols-2 gap-4 mt-4">
        <Bloco titulo="Pedidos por status">
          {pedidosPorStatus.length === 0 ? (
            <Vazio texto="Nenhum pedido no período." />
          ) : (
            <GraficoStatus dados={pedidosPorStatus} />
          )}
        </Bloco>

        <Bloco titulo="Mais vendidos">
          {produtosMaisVendidos.length === 0 ? (
            <Vazio texto="Nenhuma venda no período." />
          ) : (
            <GraficoProdutos dados={produtosMaisVendidos} />
          )}
        </Bloco>

        <Bloco titulo="Frete por serviço">
          {vendasPorFrete.length === 0 ? (
            <Vazio texto="Nenhum pedido no período." />
          ) : (
            <GraficoFrete dados={vendasPorFrete} />
          )}
        </Bloco>

        <Bloco titulo="Site x Shopee">
          <GraficoCanal dados={vendasPorCanal} />
          <ul className="mt-2 flex justify-around text-xs text-ink/60">
            {vendasPorCanal.map((c) => (
              <li key={c.canal} className="text-center">
                <p>{c.canal}</p>
                <p className="font-mono">{c.pedidos} ped. · {reais(c.ticketMedio)}</p>
              </li>
            ))}
          </ul>
        </Bloco>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mt-4">
        <Bloco titulo={`Estoque baixo (≤ 5 un.)`}>
          {estoqueBaixo.length === 0 ? (
            <Vazio texto="Nenhum produto com estoque baixo." />
          ) : (
            <ul className="divide-y divide-line text-sm">
              {estoqueBaixo.map((item, i) => (
                <li key={i} className="flex items-center justify-between py-2">
                  <span className="truncate">
                    {item.nome}
                    {item.combinacao && (
                      <span className="text-ink/50"> — {item.combinacao.replaceAll("|", ", ")}</span>
                    )}
                  </span>
                  <span className={`font-mono ml-3 ${item.estoque === 0 ? "text-berry" : ""}`}>
                    {item.estoque}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Bloco>

        <Bloco titulo="Cupons mais usados">
          {cuponsMaisUsados.length === 0 ? (
            <Vazio texto="Nenhum cupom usado no período." />
          ) : (
            <ul className="divide-y divide-line text-sm">
              {cuponsMaisUsados.map((c) => (
                <li key={c.codigo} className="flex items-center justify-between py-2">
                  <span className="font-mono truncate">{c.codigo}</span>
                  <span className="text-ink/60 text-xs">{c.usos} usos</span>
                  <span className="font-mono ml-3">{reais(c.descontoTotal)}</span>
                </li>
              ))}
            </ul>
          )}
        </Bloco>
      </div>
    </div>
  );
}

function reais(valor: number) {
  return `R$ ${valor.toFixed(2).replace(".", ",")}`;
}

// Devolução acima de 10% dos pedidos do mês não é ruído: vale a cor de alerta.
function Cartao({ label, valor, alerta }: { label: string; valor: string; alerta?: boolean }) {
  return (
    <div className="bg-white border border-line rounded-lg p-4">
      <p className="text-xs text-ink/50 mb-1">{label}</p>
      <p className={`font-mono text-lg font-medium ${alerta ? "text-berry" : ""}`}>{valor}</p>
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-line rounded-lg p-5">
      <p className="text-sm font-medium mb-3">{titulo}</p>
      {children}
    </div>
  );
}

function Vazio({ texto }: { texto: string }) {
  return <p className="text-sm text-ink/50 py-12 text-center">{texto}</p>;
}
