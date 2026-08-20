-- CreateTable
-- Estoque por combinação de variação (ex: Cor=Preta + Tamanho=G). Produto
-- sem variações continua usando só "Produto"."estoque". Produto com
-- variações e controle ligado ganha uma linha aqui por combinação — sem
-- nenhuma linha, mesmo tendo variações, o produto vende sem limite (igual
-- sempre foi). `combinacao` é a chave canônica gerada em
-- src/lib/estoque-variacao.ts.
CREATE TABLE "EstoqueVariacao" (
    "id" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "combinacao" TEXT NOT NULL,
    "estoque" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EstoqueVariacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EstoqueVariacao_produtoId_idx" ON "EstoqueVariacao"("produtoId");

-- CreateIndex
CREATE UNIQUE INDEX "EstoqueVariacao_produtoId_combinacao_key" ON "EstoqueVariacao"("produtoId", "combinacao");

-- AddForeignKey
ALTER TABLE "EstoqueVariacao" ADD CONSTRAINT "EstoqueVariacao_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Mesma trava que já existe em "Produto"."estoque": nunca deixa gravar
-- número negativo, nem por fora do serviço.
ALTER TABLE "EstoqueVariacao"
  ADD CONSTRAINT "estoque_variacao_nao_negativo" CHECK ("estoque" >= 0);

-- AlterTable (Variacao)
-- Foto por valor de cor — null preserva todo produto já cadastrado exibindo
-- só o chip de texto de sempre até o admin subir as fotos.
ALTER TABLE "Variacao" ADD COLUMN "imagensValores" JSONB;
