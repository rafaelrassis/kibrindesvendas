-- Cupom pode ser restrito a um produto específico e/ou à primeira compra do
-- cliente. Ver comentário do model Cupom em schema.prisma.
ALTER TABLE "Cupom" ADD COLUMN "produtoId" TEXT;
ALTER TABLE "Cupom" ADD COLUMN "primeiraCompra" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Cupom_produtoId_idx" ON "Cupom"("produtoId");

-- AddForeignKey
-- RESTRICT (não o SetNull padrão do Prisma pra relação opcional): apagar um
-- produto vinculado a cupom fica bloqueado pelo banco, do mesmo jeito que já
-- acontece com ItemPedido. removerProduto confere isso antes, com uma
-- mensagem amigável.
ALTER TABLE "Cupom" ADD CONSTRAINT "Cupom_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
