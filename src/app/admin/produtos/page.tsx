import { produtos } from "@/lib/mock-data";
import AdminNav from "@/components/AdminNav";

export default function AdminProdutosPage() {
  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      <h1 className="font-display text-3xl mb-1">Produtos</h1>
      <p className="text-ink/60 mb-2 text-sm">
        Área interna (mock) — cadastro real de produtos entra na Fase 1.
      </p>
      <AdminNav />

      <div className="bg-white border border-line rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-paper-2 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Produto</th>
              <th className="px-4 py-3 font-medium">Categoria</th>
              <th className="px-4 py-3 font-medium">Preço</th>
              <th className="px-4 py-3 font-medium">Personalização</th>
            </tr>
          </thead>
          <tbody>
            {produtos.map((p) => (
              <tr key={p.id} className="border-t border-line">
                <td className="px-4 py-3">{p.emoji} {p.nome}</td>
                <td className="px-4 py-3 text-ink/60">{p.categoriaLabel}</td>
                <td className="px-4 py-3 font-mono">R$ {p.preco.toFixed(2).replace(".", ",")}</td>
                <td className="px-4 py-3">
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      p.requerPersonalizacao
                        ? "bg-mustard/20 text-pine-2"
                        : "bg-ink/5 text-ink/50"
                    }`}
                  >
                    {p.requerPersonalizacao ? "Sim" : "Não"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
