-- Defaults globais de margem Shopee
ALTER TABLE "ConfiguracaoLoja"
  ADD COLUMN "shopeeComissaoPct" DECIMAL(5,2),
  ADD COLUMN "shopeeFretePct" DECIMAL(5,2),
  ADD COLUMN "shopeeAdsPct" DECIMAL(5,2);

-- Overrides por produto
ALTER TABLE "Produto"
  ADD COLUMN "shopeeComissaoPct" DECIMAL(5,2),
  ADD COLUMN "shopeeFretePct" DECIMAL(5,2),
  ADD COLUMN "shopeeAdsPct" DECIMAL(5,2);

-- Lançamentos manuais de venda Shopee
CREATE TABLE "VendaShopee" (
    "id" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "combinacao" TEXT,
    "quantidade" INTEGER NOT NULL,
    "valorVenda" DECIMAL(10,2) NOT NULL,
    "custoTotal" DECIMAL(10,2) NOT NULL,
    "comissaoPct" DECIMAL(5,2) NOT NULL,
    "fretePct" DECIMAL(5,2) NOT NULL,
    "adsPct" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendaShopee_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VendaShopee_produtoId_idx" ON "VendaShopee"("produtoId");
CREATE INDEX "VendaShopee_createdAt_idx" ON "VendaShopee"("createdAt");

ALTER TABLE "VendaShopee" ADD CONSTRAINT "VendaShopee_produtoId_fkey"
  FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
