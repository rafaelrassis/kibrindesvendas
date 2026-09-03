-- Dimensões de envio passam a ser por unidade e em milímetros (antes eram em
-- cm e a "altura" fazia dupla função de espessura empilhável e dimensão fixa,
-- o que causava reclassificação errada de frete pra pedidos com muitas
-- unidades). Rename 1:1 dos 3 campos existentes, convertendo cm -> mm
-- (multiplica por 10) pra não perder os valores já cadastrados.
ALTER TABLE "Produto" RENAME COLUMN "alturaCm" TO "espessuraMm";
ALTER TABLE "Produto" RENAME COLUMN "larguraCm" TO "alturaMm";
ALTER TABLE "Produto" RENAME COLUMN "comprimentoCm" TO "comprimentoMm";

UPDATE "Produto" SET
  "espessuraMm" = "espessuraMm" * 10,
  "alturaMm" = "alturaMm" * 10,
  "comprimentoMm" = "comprimentoMm" * 10;

ALTER TABLE "Produto" ALTER COLUMN "espessuraMm" SET DEFAULT 40;
ALTER TABLE "Produto" ALTER COLUMN "alturaMm" SET DEFAULT 110;
ALTER TABLE "Produto" ALTER COLUMN "comprimentoMm" SET DEFAULT 160;
