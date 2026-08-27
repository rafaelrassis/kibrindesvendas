-- Prazo de entrega (dias) cotado junto com o frete, congelado no pedido.
ALTER TABLE "Pedido" ADD COLUMN "fretePrazoDias" INTEGER;
