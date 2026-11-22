import "dotenv/config";
import { prisma } from "../src/db.js";

// Uso: npm run admin -- correo@ejemplo.com
const correo = (process.argv[2] ?? "").trim().toLowerCase();
if (!correo) {
  console.error("Uso: npm run admin -- correo@ejemplo.com");
  process.exit(1);
}
const r = await prisma.usuario.updateMany({ where: { correo }, data: { rol: "admin" } });
console.log(r.count ? `${correo} ahora es admin` : "No existe un usuario con ese correo");
await prisma.$disconnect();
