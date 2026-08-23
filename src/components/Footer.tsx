import Image from "next/image";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

// Mesmas variáveis usadas no resto do site. Sem elas o item vira texto simples:
// link com href="#" parece clicável e não leva a lugar nenhum.
const WHATSAPP_LOJA = process.env.NEXT_PUBLIC_WHATSAPP_LOJA;
const SHOPEE_URL = process.env.NEXT_PUBLIC_SHOPEE_URL;

export default function Footer() {
  return (
    <footer className="bg-pine text-paper/70 mt-16">
      <div className="mx-auto max-w-6xl px-5 py-10 flex flex-col md:flex-row justify-between gap-6 text-sm">
        <div>
          <Image src="/logo.png" alt="LeoKibrindes" width={140} height={45} className="h-9 w-auto mb-2" />
          <p className="mt-1 max-w-xs">
            Presentes personalizados feitos pra durar.
          </p>
        </div>
        <div className="flex gap-10">
          <div>
            <p className="text-paper/50 uppercase text-xs tracking-wide mb-2">Loja</p>
            {SHOPEE_URL ? (
              <a
                href={SHOPEE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="block hover:text-mustard transition-colors"
              >
                Também na Shopee
              </a>
            ) : (
              <p>Também na Shopee</p>
            )}
            {WHATSAPP_LOJA ? (
              <a
                href={`https://wa.me/${WHATSAPP_LOJA}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block hover:text-mustard transition-colors"
              >
                WhatsApp de atendimento
              </a>
            ) : (
              <p>WhatsApp de atendimento</p>
            )}
          </div>
          <div>
            <p className="text-paper/50 uppercase text-xs tracking-wide mb-2">Ajuda</p>
            <Link href="/suporte" className="block hover:text-mustard transition-colors">
              Suporte / FAQ
            </Link>
          </div>
        </div>
      </div>

      {/* Selos de segurança e pagamento */}
      <div className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-5 py-5 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs">
          <span className="inline-flex items-center gap-1.5 text-paper/60">
            <ShieldCheck size={16} className="text-mustard" aria-hidden="true" />
            Site seguro — SSL
          </span>
          <div className="flex items-center gap-2 text-paper/60" aria-label="Formas de pagamento aceitas">
            <span className="border border-white/20 rounded px-2 py-1">Pix</span>
            <span className="border border-white/20 rounded px-2 py-1">Visa</span>
            <span className="border border-white/20 rounded px-2 py-1">Mastercard</span>
          </div>
        </div>
      </div>

      {/* Informações legais — obrigatórias para e-commerce (Lei 8.078/90 e Decreto 7.962/13) */}
      <div className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-5 py-5 text-xs text-paper/50 space-y-1">
          <p>LeoKibrindes Personalizados — CNPJ: 53.686.886/0001-35</p>
          <p>
            E-mail de contato:{" "}
            <a href="mailto:leokibrindes@gmail.com" className="hover:text-mustard transition-colors">
              leokibrindes@gmail.com
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
