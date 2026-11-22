import "dotenv/config";

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error("Falta JWT_SECRET (mínimo 32 caracteres) en el archivo .env");
  process.exit(1);
}

if (!/^[0-9a-f]{64}$/i.test(process.env.CIFRADO_KEY ?? "")) {
  console.error("Falta CIFRADO_KEY (64 caracteres hexadecimales) en el archivo .env");
  process.exit(1);
}

// Se importa después de validar el .env
const { app } = await import("./app.js");

const puerto = process.env.PORT || 3000;
app.listen(puerto, () => console.log(`API escuchando en http://localhost:${puerto}`));

const { iniciarRevisionProgramada } = await import("./jobs/revision.js");
iniciarRevisionProgramada();
