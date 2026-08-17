import EntrarForm from "@/components/EntrarForm";

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  // Só caminho interno: "//host" ou uma URL absoluta viraria redirect aberto.
  const destino = next?.startsWith("/") && !next.startsWith("//") ? next : "/conta";

  return (
    <div className="mx-auto max-w-sm px-5 py-16">
      <h1 className="font-display text-3xl mb-1">Entrar</h1>
      <p className="text-ink/60 text-sm mb-8">Acesse sua conta LeoKibrindes.</p>

      <EntrarForm destino={destino} />
    </div>
  );
}
