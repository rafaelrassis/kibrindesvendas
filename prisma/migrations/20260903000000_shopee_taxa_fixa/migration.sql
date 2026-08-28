-- Taxa fixa em R$ da Shopee (não percentual), mesmo padrão substitutivo dos
-- campos de margem existentes: override no Produto, default global em
-- ConfiguracaoLoja, snapshot em VendaShopee.
ALTER TABLE "Produto" ADD COLUMN "shopeeTaxaFixa" DECIMAL(10,2);
ALTER TABLE "ConfiguracaoLoja" ADD COLUMN "shopeeTaxaFixa" DECIMAL(10,2);
ALTER TABLE "VendaShopee" ADD COLUMN "taxaFixa" DECIMAL(10,2) NOT NULL DEFAULT 0;
