import AdminNav from "@/components/AdminNav";
import { GraficoProdutos, GraficoStatus, GraficoVendas } from "@/components/AdminDashboardCharts";
import { exigirAdmin } from "@/lib/admin";
import { getDadosDoPainel } from "@/lib/data/dashboard";

export default async function AdminPainelPage() {
  await exigirAdmin();
  const { vendasPorDia, pedidosPorStatus, produtosMaisVendidos, resumo } =
    await getDadosDoPainel();

  const semVendas = resumo.totalPedidos === 0;

  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      <h1 className="font-display text-3xl mb-1">Painel</h1>
      <p className="text-ink/60 text-sm mb-2">
        Últimos 30 dias. Pedido só entra no faturamento depois de pago —
        aguardando pagamento e cancelado ficam de fora.
      </p>
      <AdminNav />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Cartao label="Vendas" valor={reais(resumo.totalVendas)} />
        <Cartao label="Pedidos pagos" valor={String(resumo.totalPedidos)} />
        <Cartao label="Ticket médio" valor={reais(resumo.ticketMedio)} />
        <Cartao
          label="Devoluções"
          valor={`${resumo.totalDevolucoes} (${resumo.taxaDevolucao.toFixed(1).replace(".", ",")}%)`}
          alerta={resumo.taxaDevolucao > 10}
        />
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
