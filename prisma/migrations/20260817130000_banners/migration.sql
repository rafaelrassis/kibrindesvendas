-- CreateTable
CREATE TABLE "Banner" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "eyebrow" TEXT NOT NULL,
    "precoTexto" TEXT NOT NULL,
    "ctaHref" TEXT NOT NULL,
    "imagemUrl" TEXT,
    "corFundo" TEXT NOT NULL DEFAULT '#3F6B4C',
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Banner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Banner_ativo_ordem_idx" ON "Banner"("ativo", "ordem");
