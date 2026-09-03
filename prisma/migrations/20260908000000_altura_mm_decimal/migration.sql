-- `alturaMm` passa a aceitar casas decimais: é a dimensão que empilha com a
-- quantidade, e produtos finos de verdade (ex: ímã de 0.4mm) truncariam pra 0
-- como Int, quebrando o empilhamento (0 x quantidade nunca cresce).
ALTER TABLE "Produto" ALTER COLUMN "alturaMm" TYPE DOUBLE PRECISION;
