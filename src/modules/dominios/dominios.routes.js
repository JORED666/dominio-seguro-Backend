import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db.js";
import { requiereAuth } from "../../middleware/auth.js";
import { esDominioValido, resolverIpPublica } from "../../lib/seguridad.js";
import { revisarCertificado } from "../../integrations/tls.js";
import { descubrirSubdominios } from "../../integrations/crtsh.js";
import { calcularPuntaje, nivelDePuntaje } from "../../domain/puntaje.js";

const router = Router();
router.use(requiereAuth);

const dominioSchema = z.object({
  nombre: z.string().trim().toLowerCase().refine(esDominioValido, "Dominio inválido"),
});

// Lista los dominios del usuario autenticado
router.get("/", async (req, res) => {
  const dominios = await prisma.dominio.findMany({
    where: { usuarioId: req.usuario.id },
    orderBy: { creadoEn: "desc" },
  });
  res.json(
    dominios.map((d) => ({
      ...d,
      nivel: d.ultimoPuntaje === null ? null : nivelDePuntaje(d.ultimoPuntaje),
    }))
  );
});

// Registra un dominio
router.post("/", async (req, res) => {
  const datos = dominioSchema.safeParse(req.body);
  if (!datos.success) return res.status(400).json({ error: datos.error.issues[0].message });

  try {
    const dominio = await prisma.dominio.create({
      data: { usuarioId: req.usuario.id, nombreDominio: datos.data.nombre },
    });
    res.status(201).json(dominio);
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ error: "Ese dominio ya está registrado" });
    throw err;
  }
});

// Ejecuta un análisis (TLS + subdominios) y guarda el resultado
router.post("/:id/analizar", async (req, res) => {
  const dominio = await prisma.dominio.findFirst({
    where: { id: req.params.id, usuarioId: req.usuario.id },
  });
  if (!dominio) return res.status(404).json({ error: "Dominio no encontrado" });

  const inicio = Date.now();
  const host = dominio.nombreDominio;

  let ip;
  try {
    ip = await resolverIpPublica(host);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const [resCert, resCrt] = await Promise.allSettled([
    revisarCertificado(ip, host),
    descubrirSubdominios(host),
  ]);

  const cert = resCert.status === "fulfilled" ? resCert.value : null;
  const subdominios = resCrt.status === "fulfilled" ? resCrt.value : [];
  const errorCrt = resCrt.status === "rejected";

  const { puntaje, hallazgos } = calcularPuntaje({ cert, subdominios, errorCrt });

  const analisis = await prisma.analisis.create({
    data: {
      dominioId: dominio.id,
      puntaje,
      duracionMs: Date.now() - inicio,
      hallazgos: { create: hallazgos },
    },
    include: { hallazgos: true },
  });
  await prisma.dominio.update({ where: { id: dominio.id }, data: { ultimoPuntaje: puntaje } });

  res.status(201).json({ ...analisis, nivel: nivelDePuntaje(puntaje), certificado: cert, subdominios });
});

// Historial de análisis de un dominio
router.get("/:id/analisis", async (req, res) => {
  const dominio = await prisma.dominio.findFirst({
    where: { id: req.params.id, usuarioId: req.usuario.id },
  });
  if (!dominio) return res.status(404).json({ error: "Dominio no encontrado" });

  const analisis = await prisma.analisis.findMany({
    where: { dominioId: dominio.id },
    orderBy: { fecha: "desc" },
    include: { hallazgos: true },
  });
  res.json(analisis.map((a) => ({ ...a, nivel: nivelDePuntaje(a.puntaje) })));
});

export default router;
