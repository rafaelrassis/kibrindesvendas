import { exigirAdmin } from "@/lib/admin";

// Rede de segurança pras telas internas que são Client Component (produtos e
// categorias, que só puxam catálogo público pela API). As telas de servidor
// chamam exigirAdmin() elas mesmas, antes de qualquer query.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await exigirAdmin();
  return <>{children}</>;
}
