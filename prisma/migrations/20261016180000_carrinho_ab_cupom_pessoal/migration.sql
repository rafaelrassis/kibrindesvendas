-- Cupom pessoal (só uma conta usa) e variante do assunto do lembrete (teste A/B).
ALTER TABLE "Cupom" ADD COLUMN "usuarioId" TEXT;
ALTER TABLE "LembreteCarrinho" ADD COLUMN "variante" TEXT;
