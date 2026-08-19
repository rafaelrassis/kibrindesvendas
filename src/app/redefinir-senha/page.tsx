import RedefinirSenhaForm from "@/components/RedefinirSenhaForm";

export default async function RedefinirSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <div className="mx-auto max-w-sm px-5 py-16">
      <h1 className="font-display text-3xl mb-1">Redefinir senha</h1>
      <p className="text-ink/60 text-sm mb-8">Escolha uma nova senha pra sua conta.</p>

      <RedefinirSenhaForm token={token} />
    </div>
  );
}
