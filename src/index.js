import "dotenv/config";

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error("Falta JWT_SECRET (mínimo 32 caracteres) en el archivo .env");
  process.exit(1);
}

// Se importa después de validar el .env
const { app } = await import("./app.js");

const puerto = process.env.PORT || 3000;
app.listen(puerto, () => console.log(`API escuchando en http://localhost:${puerto}`));
