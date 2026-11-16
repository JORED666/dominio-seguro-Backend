-- CreateTable
CREATE TABLE "similares" (
    "id" TEXT NOT NULL,
    "dominio_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tecnica" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "riesgo" TEXT NOT NULL,
    "con_correo" BOOLEAN NOT NULL,
    "con_certificado" BOOLEAN NOT NULL,
    "propio" BOOLEAN NOT NULL DEFAULT false,
    "revisado" BOOLEAN NOT NULL DEFAULT false,
    "detectado_en" TIMESTAMP(3),
    "verificado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "similares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "similares_dominio_id_nombre_key" ON "similares"("dominio_id", "nombre");

-- AddForeignKey
ALTER TABLE "similares" ADD CONSTRAINT "similares_dominio_id_fkey" FOREIGN KEY ("dominio_id") REFERENCES "dominios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
