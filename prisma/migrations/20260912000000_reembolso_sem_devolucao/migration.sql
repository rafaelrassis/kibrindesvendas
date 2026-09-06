-- Reembolso concedido pela loja sem devolução física do produto.
ALTER TABLE "Pedido" ADD COLUMN "valorReembolsado" DECIMAL(10,2);
ALTER TABLE "Pedido" ADD COLUMN "motivoReembolso" TEXT;
ALTER TABLE "Pedido" ADD COLUMN "reembolsadoEm" TIMESTAMP(3);
