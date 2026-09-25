-- AlterTable
ALTER TABLE "Produto" ADD COLUMN     "fornecedorUrl" TEXT,
ADD COLUMN     "fornecedorVerificadoEm" TIMESTAMP(3),
ADD COLUMN     "fornecedorErro" TEXT,
ADD COLUMN     "fornecedorAviso" TEXT,
ADD COLUMN     "fornecedorPreco" DECIMAL(10,2),
ADD COLUMN     "fornecedorPrecoAnterior" DECIMAL(10,2),
ADD COLUMN     "fornecedorPausouProduto" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ConfiguracaoLoja" ADD COLUMN     "syncFornecedorAtivo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "syncFornecedorDias" INTEGER[] DEFAULT ARRAY[0, 1, 2, 3, 4, 5, 6]::INTEGER[],
ADD COLUMN     "syncFornecedorHorarios" TEXT[] DEFAULT ARRAY['08:00']::TEXT[],
ADD COLUMN     "syncFornecedorEstoqueReposicao" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "syncFornecedorPausarEsgotado" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "syncFornecedorEmailAlerta" TEXT,
ADD COLUMN     "syncFornecedorUltimaExecucao" TIMESTAMP(3),
ADD COLUMN     "syncFornecedorResumo" JSONB;
