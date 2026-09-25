import "server-only";
import { revalidatePath } from "next/cache";

// Mesmas páginas que a edição de produto no admin revalida — estoque zerado
// pela sync precisa sumir da vitrine sem esperar o cache vencer.
export function revalidarProdutos(produtos: { produtoId: string; categoria: string; alterado: boolean }[]) {
  const alterados = produtos.filter((p) => p.alterado);
  if (alterados.length === 0) return;
  revalidatePath("/");
  for (const p of alterados) {
    revalidatePath(`/produto/${p.produtoId}`);
    revalidatePath(`/categoria/${p.categoria}`);
  }
}
