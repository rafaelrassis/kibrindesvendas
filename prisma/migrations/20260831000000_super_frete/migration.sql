-- CreateEnum
CREATE TYPE "TransportadoraFrete" AS ENUM ('MELHOR_ENVIO', 'SUPER_FRETE');

-- AlterTable
ALTER TABLE "ConfiguracaoLoja"
  ADD COLUMN "superFreteToken" TEXT,
  ADD COLUMN "transportadoraAtiva" "TransportadoraFrete" NOT NULL DEFAULT 'MELHOR_ENVIO';

-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN "freteServico" TEXT;
