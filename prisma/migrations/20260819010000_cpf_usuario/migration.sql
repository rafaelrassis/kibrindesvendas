-- Nullable no banco (Postgres permite múltiplos NULLs em coluna UNIQUE) pra
-- não quebrar usuários já cadastrados sem CPF. Obrigatoriedade real é
-- aplicada na API de registro (src/app/api/auth/registro/route.ts).
ALTER TABLE "Usuario" ADD COLUMN "cpf" TEXT;
CREATE UNIQUE INDEX "Usuario_cpf_key" ON "Usuario"("cpf");
