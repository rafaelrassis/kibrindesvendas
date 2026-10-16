"use client";

// Abre o WhatsApp e registra o clique (fire-and-forget) pra medir o que o contato
// manual recupera. Falha no registro nunca atrapalha a abertura do link.
export default function BotaoChamar({
  href,
  contato,
}: {
  href: string;
  contato: { usuarioId?: string; email?: string };
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline text-xs"
      onClick={() => {
        fetch("/api/admin/carrinhos/contato", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(contato),
          keepalive: true,
        }).catch(() => {});
      }}
    >
      Chamar
    </a>
  );
}
