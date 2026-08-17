import Link from "next/link";

export default function RestritoPage() {
  return (
    <div className="mx-auto max-w-md px-5 py-20 text-center">
      <p className="text-4xl mb-4">🔒</p>
      <h1 className="font-display text-2xl mb-2">Área restrita</h1>
      <p className="text-ink/60 text-sm mb-6">
        Essa parte do site é da equipe da loja. Se você precisa de acesso, fale
        com quem administra a LeoKibrindes.
      </p>
      <Link
        href="/"
        className="inline-block bg-pine text-paper px-6 py-2.5 rounded-full text-sm"
      >
        Voltar pra loja
      </Link>
    </div>
  );
}
