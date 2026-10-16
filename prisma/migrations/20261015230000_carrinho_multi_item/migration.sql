-- Carrinho passa a ter várias linhas por usuário (antes era 1 item só, por
-- causa do índice único em usuarioId).
DROP INDEX "CarrinhoItem_usuarioId_key";

-- `chave` é o id da linha gerado no navegador; as linhas já existentes ganham
-- o próprio id como chave, o que basta pra serem únicas por usuário.
ALTER TABLE "CarrinhoItem" ADD COLUMN "chave" TEXT;
UPDATE "CarrinhoItem" SET "chave" = "id";
ALTER TABLE "CarrinhoItem" ALTER COLUMN "chave" SET NOT NULL;
ALTER TABLE "CarrinhoItem" ADD COLUMN "ordem" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "CarrinhoItem_usuarioId_chave_key" ON "CarrinhoItem"("usuarioId", "chave");
CREATE INDEX "CarrinhoItem_usuarioId_idx" ON "CarrinhoItem"("usuarioId");
