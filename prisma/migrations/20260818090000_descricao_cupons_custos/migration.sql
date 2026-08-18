-- CreateEnum
CREATE TYPE "TipoCupom" AS ENUM ('PERCENTUAL', 'FIXO');

-- AlterTable
ALTER TABLE "Produto" ADD COLUMN     "descricaoDetalhada" TEXT;

-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN     "cupomCodigo" TEXT,
ADD COLUMN     "desconto" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "MaterialProduto" (
    "id" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "quantidade" DECIMAL(10,3) NOT NULL DEFAULT 1,
    "custoUnitario" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "MaterialProduto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cupom" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "tipo" "TipoCupom" NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "validoAte" TIMESTAMP(3),
    "usoMaximo" INTEGER,
    "usos" INTEGER NOT NULL DEFAULT 0,
    "valorMinimoPedido" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cupom_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cupom_codigo_key" ON "Cupom"("codigo");

-- AddForeignKey
ALTER TABLE "MaterialProduto" ADD CONSTRAINT "MaterialProduto_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
