import Link from "next/link";

const links = [
  { href: "/admin", label: "Painel" },
  { href: "/admin/produtos", label: "Produtos" },
  { href: "/admin/categorias", label: "Categorias" },
  { href: "/admin/cupons", label: "Cupons" },
  { href: "/admin/pedidos", label: "Pedidos" },
  { href: "/admin/banners", label: "Banners" },
];

export default function AdminNav() {
  return (
    <div className="flex gap-5 text-sm border-b border-line mb-8">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className="pb-3 -mb-px border-b-2 border-transparent hover:border-pine hover:text-pine transition-colors"
        >
          {l.label}
        </Link>
      ))}
    </div>
  );
}
