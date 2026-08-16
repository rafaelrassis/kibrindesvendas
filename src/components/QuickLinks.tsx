import Link from "next/link";
import { FolderOpen, PenLine, Zap, HelpCircle, MessageCircle } from "lucide-react";

const atalhos = [
  { href: "/categorias", label: "Categorias", icon: FolderOpen, bg: "#F6EEF6", color: "#9C1C95" },
  { href: "/personalizar/ima-pet-01", label: "Personalizar", icon: PenLine, bg: "#FBF0DA", color: "#D9A63E" },
  { href: "/categoria/imas", label: "Ofertas", icon: Zap, bg: "#F3E4F2", color: "#7A1674" },
  { href: "/suporte", label: "Como funciona", icon: HelpCircle, bg: "#F6EEF6", color: "#9C1C95" },
  { href: "/suporte", label: "Suporte", icon: MessageCircle, bg: "#FBF0DA", color: "#D9A63E" },
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
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ backgroundColor: a.bg, color: a.color }}
            >
              <a.icon size={22} strokeWidth={1.75} />
            </span>
            <span className="text-[11px] text-ink/70 leading-tight">{a.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
