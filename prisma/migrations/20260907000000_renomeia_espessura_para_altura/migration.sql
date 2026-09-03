-- "espessura" era um termo estranho pro que sempre foi chamado de "altura"
-- (a dimensão que empilha com a quantidade). Volta pro nome convencional:
-- altura (empilha), largura (fixa), comprimento (fixo) — mesmos valores,
-- só troca de nome. `alturaMm` precisa liberar o nome antes: primeiro vira
-- `larguraMm`, depois `espessuraMm` assume `alturaMm`.
ALTER TABLE "Produto" RENAME COLUMN "alturaMm" TO "larguraMm";
ALTER TABLE "Produto" RENAME COLUMN "espessuraMm" TO "alturaMm";

ALTER TABLE "Produto" ALTER COLUMN "alturaMm" SET DEFAULT 40;
ALTER TABLE "Produto" ALTER COLUMN "larguraMm" SET DEFAULT 110;
