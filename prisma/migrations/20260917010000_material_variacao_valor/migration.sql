-- Material vinculado a um valor de variação específico. null = comum a
-- todas (comportamento anterior, sem quebra pros produtos existentes).
ALTER TABLE "MaterialProduto" ADD COLUMN "variacaoValor" TEXT;
