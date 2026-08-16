import Link from "next/link";

const atalhos = [
  { href: "/categorias", label: "Categorias", icon: "📂", bg: "#F6EEF6", color: "#9C1C95" },
  { href: "/personalizar/ima-pet-01", label: "Personalizar", icon: "✏️", bg: "#FBF0DA", color: "#D9A63E" },
  { href: "/categoria/imas", label: "Ofertas", icon: "⚡", bg: "#F3E4F2", color: "#7A1674" },
  { href: "/suporte", label: "Como funciona", icon: "❓", bg: "#F6EEF6", color: "#9C1C95" },
  { href: "/suporte", label: "Suporte", icon: "💬", bg: "#FBF0DA", color: "#D9A63E" },
];

export default function QuickLinks() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-6">
      <div className="flex gap-5 overflow-x-auto scrollbar-hide">
        {atalhos.map((a) => (
          <Link
            key={a.label}
            href={a.href}
            className="shrink-0 flex flex-col items-center gap-2 w-16 text-center"
          >
            <span
              className="w-14 h-14 rounded-full flex items-center justify-center text-2xl"
              style={{ backgroundColor: a.bg, color: a.color }}
            >
              {a.icon}
            </span>
            <span className="text-[11px] text-ink/70 leading-tight">{a.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
