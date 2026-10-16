import Link from "next/link";
import AdminNav from "@/components/AdminNav";
import { exigirAdmin } from "@/lib/admin";
import { getPainelCarrinhos } from "@/lib/data/carrinhos-painel";

const reais = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (n: number) => `${n.toFixed(1).replace(".", ",")}%`;
const PERIODOS = [7, 30, 90];

function Cartao({ titulo, valor, detalhe }: { titulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="bg-white border border-line rounded-lg p-4">
      <p className="text-xs text-ink/50 mb-1">{titulo}</p>
      <p className="font-mono text-xl font-semibold">{valor}</p>
      {detalhe && <p className="text-xs text-ink/50 mt-1">{detalhe}</p>}
    </div>
  );
}

function horas(h: number) {
  return h < 48 ? `${h}h` : `${Math.floor(h / 24)}d`;
}

export default async function AdminCarrinhosPage({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string }>;
}) {
  await exigirAdmin();
  const { dias: diasParam } = await searchParams;
  const dias = PERIODOS.includes(Number(diasParam)) ? Number(diasParam) : 30;
  const p = await getPainelCarrinhos(dias);

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="font-display text-3xl mb-1">Carrinhos</h1>
      <p className="text-ink/60 text-sm mb-2">
        Carrinhos parados e o resultado dos e-mails de recuperação. Recuperado = o cliente fez um
        pedido em até 7 dias depois do lembrete.
      </p>
      <AdminNav />

      <div className="flex items-center gap-2 mb-6 text-sm">
        <span className="text-ink/60">Período:</span>
        {PERIODOS.map((d) => (
          <Link
            key={d}
            href={`/admin/carrinhos?dias=${d}`}
            className={`px-3 py-1 rounded-full border ${
              d === dias ? "bg-pine text-white border-pine" : "border-line hover:border-pine"
            }`}
          >
            {d} dias
          </Link>
        ))}
        <Link href="/admin/configuracoes" className="ml-auto text-xs underline text-ink/60">
          Ligar / desligar e-mails
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <Cartao
          titulo="Carrinhos ativos"
          valor={String(p.ativos.carrinhos)}
          detalhe={reais(p.ativos.valor)}
        />
        <Cartao
          titulo="Parados há 24h+"
          valor={String(p.esquecidos.carrinhos)}
          detalhe={reais(p.esquecidos.valor)}
        />
        <Cartao
          titulo="Lembretes enviados"
          valor={String(p.lembretes.enviados)}
          detalhe={`${p.lembretes.recuperados} recuperado(s)`}
        />
        <Cartao
          titulo="Taxa de recuperação"
          valor={p.lembretes.taxa === null ? "—" : pct(p.lembretes.taxa)}
          detalhe={`${reais(p.lembretes.receita)} recuperados`}
        />
      </div>

      <h2 className="font-display text-xl mb-3">Lembretes por tipo</h2>
      <div className="bg-white border border-line rounded-lg mb-8 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-ink/50">
            <tr>
              <th className="px-4 py-2 font-normal">Tipo</th>
              <th className="px-4 py-2 font-normal text-right">Enviados</th>
              <th className="px-4 py-2 font-normal text-right">Recuperados</th>
              <th className="px-4 py-2 font-normal text-right">Receita</th>
            </tr>
          </thead>
          <tbody>
            {p.lembretes.porTipo.map((t) => (
              <tr key={t.tipo} className="border-t border-line">
                <td className="px-4 py-2">{t.tipo === 1 ? "24h — lembrete" : "72h — com cupom"}</td>
                <td className="px-4 py-2 text-right font-mono">{t.enviados}</td>
                <td className="px-4 py-2 text-right font-mono">{t.recuperados}</td>
                <td className="px-4 py-2 text-right font-mono">{reais(t.receita)}</td>
              </tr>
            ))}
            {p.lembretes.porVariante
              .filter((v) => v.enviados > 0)
              .map((v) => (
                <tr key={`${v.tipo}${v.variante}`} className="border-t border-line text-ink/70">
                  <td className="px-4 py-2 pl-8 text-xs">
                    {v.tipo === 1 ? "24h" : "72h"} · assunto {v.variante}
                  </td>
                  <td className="px-4 py-2 text-right font-mono">{v.enviados}</td>
                  <td className="px-4 py-2 text-right font-mono">{v.recuperados}</td>
                  <td className="px-4 py-2 text-right font-mono">{reais(v.receita)}</td>
                </tr>
              ))}
          </tbody>
        </table>
        <p className="text-xs text-ink/50 px-4 py-2 border-t border-line">
          Cupons emitidos: {p.lembretes.cuponsEmitidos} — usados: {p.lembretes.cuponsUsados}
        </p>
      </div>

      <h2 className="font-display text-xl mb-3">Visitantes que guardaram o carrinho</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <Cartao titulo="Guardados" valor={String(p.visitantes.guardados)} />
        <Cartao titulo="Lembretes enviados" valor={String(p.visitantes.lembretes)} />
        <Cartao titulo="Voltaram pelo link" valor={String(p.visitantes.recuperados)} />
        <Cartao titulo="Guardados agora" valor={String(p.visitantes.ativos)} />
      </div>

      <h2 className="font-display text-xl mb-3">Carrinhos parados (clientes)</h2>
      {p.esquecidos.lista.length === 0 ? (
        <p className="text-sm text-ink/50">Nenhum carrinho parado há mais de 24h.</p>
      ) : (
        <div className="bg-white border border-line rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-ink/50">
              <tr>
                <th className="px-4 py-2 font-normal">Cliente</th>
                <th className="px-4 py-2 font-normal text-right">Itens</th>
                <th className="px-4 py-2 font-normal text-right">Valor</th>
                <th className="px-4 py-2 font-normal text-right">Parado</th>
                <th className="px-4 py-2 font-normal text-right">Lembretes</th>
                <th className="px-4 py-2 font-normal text-right">WhatsApp</th>
              </tr>
            </thead>
            <tbody>
              {p.esquecidos.lista.map((c) => (
                <tr key={c.usuarioId} className="border-t border-line">
                  <td className="px-4 py-2">
                    {c.nome}
                    <span className="block text-xs text-ink/50">{c.email}</span>
                  </td>
                  <td className="px-4 py-2 text-right font-mono">{c.itens}</td>
                  <td className="px-4 py-2 text-right font-mono">{reais(c.valor)}</td>
                  <td className="px-4 py-2 text-right font-mono">{horas(c.paradoHaHoras)}</td>
                  <td className="px-4 py-2 text-right font-mono">{c.lembretes}</td>
                  <td className="px-4 py-2 text-right">
                    {c.whatsapp ? (
                      <a
                        href={c.whatsapp}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline text-xs"
                      >
                        Chamar
                      </a>
                    ) : (
                      <span className="text-ink/30">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
