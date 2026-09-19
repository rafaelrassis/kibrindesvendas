-- DRE: custo real do frete, snapshot de custo/taxa e despesas operacionais.
-- Todas as colunas novas são nullable: pedidos antigos continuam válidos.
ALTER TABLE "Pedido" ADD COLUMN "freteCusto" DECIMAL(10,2);
ALTER TABLE "Pedido" ADD COLUMN "taxaGatewayPct" DECIMAL(5,2);
ALTER TABLE "ItemPedido" ADD COLUMN "custoUnitario" DECIMAL(10,2);
ALTER TABLE "ConfiguracaoLoja" ADD COLUMN "taxaGatewayPct" DECIMAL(5,2);

CREATE TABLE "DespesaOperacional" (
    "id" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "descricao" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DespesaOperacional_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DespesaOperacional_data_idx" ON "DespesaOperacional"("data");
