-- Rede de segurança pras regras que o serviço (src/lib/data/cupons.ts) já
-- aplica: as travas só disparam se alguma escrita chegar por fora dele (seed,
-- script manual, migration futura). Prisma não descreve CHECK no schema, então
-- as constraints vivem aqui — o comentário no model Cupom aponta pra cá.
ALTER TABLE "Cupom"
  ADD CONSTRAINT "cupom_valor_positivo" CHECK ("valor" > 0),
  ADD CONSTRAINT "cupom_percentual_max" CHECK (
    "tipo" <> 'PERCENTUAL' OR "valor" <= 100
  ),
  ADD CONSTRAINT "cupom_uso_maximo_positivo" CHECK (
    "usoMaximo" IS NULL OR "usoMaximo" > 0
  ),
  ADD CONSTRAINT "cupom_valor_minimo_nao_negativo" CHECK ("valorMinimoPedido" >= 0),
  -- Só o piso do contador: `usos <= usoMaximo` ficaria de fora porque o admin
  -- pode baixar o limite de um cupom já usado, e isso é edição válida — o
  -- cupom simplesmente para de valer.
  ADD CONSTRAINT "cupom_usos_nao_negativo" CHECK ("usos" >= 0);
