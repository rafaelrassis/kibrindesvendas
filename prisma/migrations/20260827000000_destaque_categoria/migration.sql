-- Flag independente de "destaque" (usado na vitrine "Pode te interessar"):
-- controla quais produtos aparecem primeiro dentro da prateleira de cada
-- categoria na home.
ALTER TABLE "Produto" ADD COLUMN "destaqueCategoria" BOOLEAN NOT NULL DEFAULT false;
