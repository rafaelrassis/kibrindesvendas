ALTER TABLE "Variacao" ADD COLUMN "afetaDimensao" BOOLEAN NOT NULL DEFAULT false;

-- Preserva o comportamento atual: variação que já tinha override de
-- peso/dimensão cadastrado continua valendo pro cálculo de frete.
UPDATE "Variacao" SET "afetaDimensao" = true WHERE "dimensoesValores" IS NOT NULL;
