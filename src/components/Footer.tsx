export default function Footer() {
  return (
    <footer className="bg-pine text-paper/70 mt-16">
      <div className="mx-auto max-w-6xl px-5 py-10 flex flex-col md:flex-row justify-between gap-6 text-sm">
        <div>
          <p className="font-display text-lg text-paper">LeoKibrindes</p>
          <p className="mt-1 max-w-xs">
            Presentes personalizados feitos pra durar. Protótipo interno — não é loja real.
          </p>
        </div>
        <div className="flex gap-10">
          <div>
            <p className="text-paper/50 uppercase text-xs tracking-wide mb-2">Loja</p>
            <p>Também na Shopee</p>
            <p>WhatsApp de atendimento</p>
          </div>
          <div>
            <p className="text-paper/50 uppercase text-xs tracking-wide mb-2">Ajuda</p>
            <p>Suporte / FAQ</p>
            <p>Trocas e devoluções</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
