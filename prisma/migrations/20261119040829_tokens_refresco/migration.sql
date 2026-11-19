-- CreateTable
CREATE TABLE "tokens_refresco" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "familia" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "expira_en" TIMESTAMP(3) NOT NULL,
    "usado_en" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tokens_refresco_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tokens_refresco_hash_key" ON "tokens_refresco"("hash");

-- CreateIndex
CREATE INDEX "tokens_refresco_familia_idx" ON "tokens_refresco"("familia");

-- AddForeignKey
ALTER TABLE "tokens_refresco" ADD CONSTRAINT "tokens_refresco_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
