-- AlterEnum
-- Os dois status novos entram depois de ENTREGUE, que é de onde a devolução parte.
ALTER TYPE "StatusPedido" ADD VALUE 'DEVOLUCAO_SOLICITADA' AFTER 'ENTREGUE';
ALTER TYPE "StatusPedido" ADD VALUE 'DEVOLVIDO' AFTER 'DEVOLUCAO_SOLICITADA';

-- AlterTable
-- Pedidos antigos foram fechados sem frete: 0 mantém o total deles correto.
ALTER TABLE "Pedido" ADD COLUMN "frete" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "enderecoCep" TEXT,
ADD COLUMN "enderecoResumo" TEXT,
ADD COLUMN "motivoDevolucao" TEXT;
