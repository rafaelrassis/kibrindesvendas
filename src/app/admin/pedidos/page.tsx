import AdminNav from "@/components/AdminNav";
import AdminPedidoStatus from "@/components/AdminPedidoStatus";
import { getPedidosRecentes } from "@/lib/data/pedidos";
import { exigirAdmin } from "@/lib/admin";

const statusLabel: Record<string, string> = {
  AGUARDANDO_PAGAMENTO: "Aguardando pagamento",
  PAGO: "Pago",
  EM_PRODUCAO: "Em produção",
  ENVIADO: "Enviado",
  ENTREGUE: "Entregue",
  CANCELADO: "Cancelado",
};

const statusCor: Record<string, string> = {
  AGUARDANDO_PAGAMENTO: "bg-ink/5 text-ink/50",
  PAGO: "bg-mustard/20 text-pine-2",
  EM_PRODUCAO: "bg-mustard/20 text-pine-2",
  ENVIADO: "bg-pine/10 text-pine",
  ENTREGUE: "bg-pine/15 text-pine",
  CANCELADO: "bg-berry/10 text-berry",
};

export default async function AdminPedidosPage() {
  await exigirAdmin();
  const pedidos = await getPedidosRecentes();

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="font-display text-3xl mb-1">Fila de validação e produção</h1>
      <p className="text-ink/60 text-sm mb-2">
        Área interna — pedidos gravados no banco (pagamento ainda simulado).
      </p>
      <AdminNav />

      {pedidos.length === 0 ? (
        <p className="text-ink/50 text-sm">Nenhum pedido ainda.</p>
      ) : (
        <div className="space-y-4">
          {pedidos.map((p) => (
            <div key={p.id} className="bg-white border border-line rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">
                  #{p.id.slice(0, 8)} · {p.usuario.nome}
                </p>
                <span className={`text-xs px-2 py-1 rounded-full ${statusCor[p.status]}`}>
                  {statusLabel[p.status]}
                </span>
              </div>
              <p className="text-xs text-ink/50 mb-2">{p.usuario.email}</p>

              {/* Mudar o status aqui avisa o cliente na tela de notificações */}
              <AdminPedidoStatus pedidoId={p.id} statusAtual={p.status} />

              {p.itens.map((item) => (
                <div key={item.id} className="text-sm py-1 border-t border-line/60 mt-1">
                  <p>
                    {item.produto.emoji} {item.produto.nome} × {item.quantidade}
                  </p>
                  {item.personalizacao && (
                    <p className="text-xs text-ink/50 mt-0.5">
                      Personalização: {item.personalizacao.tipo}
                      {item.personalizacao.briefing ? ` — ${item.personalizacao.briefing}` : ""}
                      {item.personalizacao.arteUrl ? (
                        <>
                          {" · "}
                          <a
                            href={item.personalizacao.arteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-pine underline"
                          >
                            ver arte enviada
                          </a>
                        </>
                      ) : (
                        " · arte pendente"
                      )}
                    </p>
                  )}
                </div>
              ))}

              <p className="font-mono text-sm font-medium mt-2">
                R$ {Number(p.total).toFixed(2).replace(".", ",")}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
