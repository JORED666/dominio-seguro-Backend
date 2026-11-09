-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "rol" TEXT NOT NULL DEFAULT 'usuario',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dominios" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "nombre_dominio" TEXT NOT NULL,
    "ultimo_puntaje" INTEGER,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dominios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analisis" (
    "id" TEXT NOT NULL,
    "dominio_id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "puntaje" INTEGER NOT NULL,
    "duracion_ms" INTEGER NOT NULL,

    CONSTRAINT "analisis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hallazgos" (
    "id" TEXT NOT NULL,
    "analisis_id" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "severidad" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "recomendacion" TEXT NOT NULL,

    CONSTRAINT "hallazgos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_correo_key" ON "usuarios"("correo");

-- CreateIndex
CREATE UNIQUE INDEX "dominios_usuario_id_nombre_dominio_key" ON "dominios"("usuario_id", "nombre_dominio");

-- CreateIndex
CREATE INDEX "analisis_dominio_id_fecha_idx" ON "analisis"("dominio_id", "fecha");

-- AddForeignKey
ALTER TABLE "dominios" ADD CONSTRAINT "dominios_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analisis" ADD CONSTRAINT "analisis_dominio_id_fkey" FOREIGN KEY ("dominio_id") REFERENCES "dominios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hallazgos" ADD CONSTRAINT "hallazgos_analisis_id_fkey" FOREIGN KEY ("analisis_id") REFERENCES "analisis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
