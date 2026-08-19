-- Categoria: troca o emoji por uma imagem de verdade
ALTER TABLE "Categoria" ADD COLUMN "imagemUrl" TEXT;
ALTER TABLE "Categoria" DROP COLUMN "emoji";

-- Produto: galeria de midia (ate 4 fotos + 1 video)
ALTER TABLE "Produto" ADD COLUMN "imagens" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Produto" ADD COLUMN "video" TEXT;
