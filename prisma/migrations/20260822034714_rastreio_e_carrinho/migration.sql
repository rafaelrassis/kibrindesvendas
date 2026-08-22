-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN     "codigoRastreio" TEXT;

-- CreateTable
CREATE TABLE "CarrinhoItem" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "variacoesEscolhidas" JSONB NOT NULL DEFAULT '{}',
    "quantidade" INTEGER NOT NULL DEFAULT 1,
    "cepInformado" TEXT,
    "personalizacao" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarrinhoItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CarrinhoItem_usuarioId_key" ON "CarrinhoItem"("usuarioId");

-- AddForeignKey
ALTER TABLE "CarrinhoItem" ADD CONSTRAINT "CarrinhoItem_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
