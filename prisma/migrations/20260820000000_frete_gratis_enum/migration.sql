-- AlterEnum
-- Sozinho numa migration de propósito: um valor novo de enum só pode ser
-- usado (ex: numa CHECK constraint) depois que a transação que o criou já
-- deu commit — o Prisma aplica cada migration como uma transação só, então
-- juntar isso com a constraint que usa 'FRETE_GRATIS' na mesma migration
-- quebra o deploy com "unsafe use of new value of enum type".
ALTER TYPE "TipoCupom" ADD VALUE 'FRETE_GRATIS';
