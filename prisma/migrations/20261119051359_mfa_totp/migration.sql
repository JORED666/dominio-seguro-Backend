-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "mfa_activo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mfa_secreto" TEXT,
ADD COLUMN     "mfa_ultimo_paso" INTEGER;
