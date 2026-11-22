-- CreateTable
CREATE TABLE "tokens_restablecimiento" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "expira_en" TIMESTAMP(3) NOT NULL,
    "usado_en" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tokens_restablecimiento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tokens_restablecimiento_hash_key" ON "tokens_restablecimiento"("hash");

-- CreateIndex
CREATE INDEX "tokens_restablecimiento_usuario_id_idx" ON "tokens_restablecimiento"("usuario_id");

-- AddForeignKey
ALTER TABLE "tokens_restablecimiento" ADD CONSTRAINT "tokens_restablecimiento_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
