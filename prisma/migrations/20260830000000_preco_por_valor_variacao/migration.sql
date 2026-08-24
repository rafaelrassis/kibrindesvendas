-- Preço final por valor de variação (ex: "Tamanho imã": 7x7 = R$1, 10x10 = R$5).
-- Substitui o preço base do produto quando o valor escolhido tem entrada aqui.
ALTER TABLE "Variacao" ADD COLUMN "precosValores" JSONB;
