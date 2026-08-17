import Link from "next/link";
import type { LucideIcon } from "lucide-react";

type Props = {
  href: string;
  icon: LucideIcon;
  label: string;
  sublabel?: string;
  onClick?: () => void;
  destrutivo?: boolean;
};

export default function ContaMenuItem({
  href,
  icon: Icon,
  label,
  sublabel,
  onClick,
  destrutivo,
}: Props) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-4 px-4 py-3.5 bg-white border border-line rounded-lg hover:border-pine/40 transition-colors"
    >
      <span
        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
          destrutivo ? "bg-berry/10 text-berry" : "bg-paper-2 text-pine"
        }`}
      >
        <Icon size={18} strokeWidth={1.75} />
      </span>
      <span className="flex-1 min-w-0">
        <span className={`block text-sm ${destrutivo ? "text-berry" : "text-ink"}`}>
          {label}
        </span>
        {sublabel && (
          <span className="block text-xs text-ink/50 truncate">{sublabel}</span>
        )}
      </span>
      <span className="text-ink/30 text-lg leading-none">›</span>
    </Link>
  );
}
