-- Avaliação criada pelo admin não tem cliente real por trás.
ALTER TABLE "Avaliacao" ALTER COLUMN "usuarioId" DROP NOT NULL;
ALTER TABLE "Avaliacao" ADD COLUMN "autorNome" TEXT;
ALTER TABLE "Avaliacao" ADD COLUMN "criadoPorAdmin" BOOLEAN NOT NULL DEFAULT false;
