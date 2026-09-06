import AdminNav from "@/components/AdminNav";
import AdminPedidoStatus from "@/components/AdminPedidoStatus";
import AdminPedidoRastreio from "@/components/AdminPedidoRastreio";
import AdminPedidoRemover from "@/components/AdminPedidoRemover";
import { getPedidosRecentes } from "@/lib/data/pedidos";
import { exigirAdmin } from "@/lib/admin";
import { CLASSE_STATUS, labelStatus } from "@/lib/status-pedido";
import { formatarCep } from "@/lib/frete";
import { formatarCpf } from "@/lib/cpf";

export default async function AdminPedidosPage() {
  await exigirAdmin();
  const pedidos = await getPedidosRecentes();

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="font-display text-3xl mb-1">Fila de validação e produção</h1>
      <p className="text-ink/60 text-sm mb-2">
        Área interna — pedidos gravados no banco. Pedidos marcados como
        simulados vieram de um ambiente sem credencial do Mercado Pago e não
        têm cobrança de verdade por trás.
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
                <div className="flex items-center gap-1.5">
                  {p.pagamentoMock && (
                    <span className="text-xs px-2 py-1 rounded-full bg-ink/5 text-ink/50">
                      simulado
                    </span>
                  )}
                  <span className={`text-xs px-2 py-1 rounded-full ${CLASSE_STATUS[p.status]}`}>
                    {labelStatus(p.status)}
                  </span>
                </div>
              </div>
              <p className="text-xs text-ink/50 mb-2">
                {p.usuario.email}
                {p.usuario.telefone && ` · ${p.usuario.telefone}`}
                {p.usuario.cpf && ` · CPF ${formatarCpf(p.usuario.cpf)}`}
              </p>

              {/* Mudar o status aqui avisa o cliente na tela de notificações */}
              <AdminPedidoStatus pedidoId={p.id} statusAtual={p.status} />
              <AdminPedidoRastreio pedidoId={p.id} codigoAtual={p.codigoRastreio} />
              <AdminPedidoRemover pedidoId={p.id} />

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

              {/* Sem o endereço aqui a loja não tem como despachar. */}
              <p className="text-xs text-ink/50 mt-2">
                {p.enderecoResumo
                  ? `Enviar pra ${p.enderecoResumo}${
                      p.enderecoCep ? ` · CEP ${formatarCep(p.enderecoCep)}` : ""
                    }`
                  : "Pedido antigo, sem endereço registrado."}
              </p>

              {p.motivoDevolucao && (
                <p className="text-xs text-berry mt-1">
                  Devolução pedida pelo cliente: {p.motivoDevolucao}
                </p>
              )}

              <div className="font-mono text-xs text-ink/50 mt-2 space-y-0.5">
                <p>
                  Produtos: R${" "}
                  {(Number(p.total) - Number(p.frete) + Number(p.desconto))
                    .toFixed(2)
                    .replace(".", ",")}
                </p>
                {Number(p.desconto) > 0 && (
                  <p>
                    Desconto{p.cupomCodigo ? ` (${p.cupomCodigo})` : ""}: -R${" "}
                    {Number(p.desconto).toFixed(2).replace(".", ",")}
                  </p>
                )}
                <p>
                  Frete:{" "}
                  {p.freteGratis
                    ? "grátis"
                    : `R$ ${Number(p.frete).toFixed(2).replace(".", ",")}`}
                </p>
              </div>
              <p className="font-mono text-sm font-medium mt-1">
                Total: R$ {Number(p.total).toFixed(2).replace(".", ",")}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
