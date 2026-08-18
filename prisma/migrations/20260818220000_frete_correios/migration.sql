-- AlterTable
ALTER TABLE "Produto" ADD COLUMN     "pesoGramas" INTEGER NOT NULL DEFAULT 300,
ADD COLUMN     "alturaCm" INTEGER NOT NULL DEFAULT 4,
ADD COLUMN     "larguraCm" INTEGER NOT NULL DEFAULT 11,
ADD COLUMN     "comprimentoCm" INTEGER NOT NULL DEFAULT 16;

-- CreateTable
CREATE TABLE "ConfiguracaoLoja" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "cepOrigem" TEXT NOT NULL DEFAULT '01310100',
    "melhorEnvioToken" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracaoLoja_pkey" PRIMARY KEY ("id")
);
