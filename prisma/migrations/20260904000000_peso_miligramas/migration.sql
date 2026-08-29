-- Peso do produto passa de gramas para miligramas, permitindo itens
-- abaixo de 1g (ex: 100mg). Converte os valores existentes (x1000) antes
-- de renomear a coluna, e ajusta o default de 300 (g) para 300000 (mg).

ALTER TABLE "Produto" RENAME COLUMN "pesoGramas" TO "pesoMiligramas";

UPDATE "Produto" SET "pesoMiligramas" = "pesoMiligramas" * 1000;

ALTER TABLE "Produto" ALTER COLUMN "pesoMiligramas" SET DEFAULT 300000;
