-- Custo de material por valor de variação (mesmo padrão de precosValores),
-- substitutivo à soma de MaterialProduto. Dado interno, só usado no admin.
ALTER TABLE "Variacao" ADD COLUMN "custosValores" JSONB;
