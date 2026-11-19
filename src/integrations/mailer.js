import nodemailer from "nodemailer";

// Envío de correo. Con SMTP_HOST usa tu proveedor; sin él, en desarrollo usa una cuenta de pruebas
// de Ethereal (el correo no sale a nadie: se imprime un enlace para verlo).
let transporte;

async function obtenerTransporte() {
  if (transporte) return transporte;
  if (process.env.SMTP_HOST) {
    const puerto = Number(process.env.SMTP_PORT || 587);
    transporte = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: puerto,
      secure: puerto === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  } else if (process.env.NODE_ENV !== "production") {
    const cuenta = await nodemailer.createTestAccount();
    transporte = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      auth: { user: cuenta.user, pass: cuenta.pass },
    });
    console.log("Sin SMTP_HOST: los correos van a una bandeja de pruebas (Ethereal)");
  } else {
    throw new Error("Falta configurar SMTP_HOST para enviar correos");
  }
  return transporte;
}

export async function enviarCorreo({ para, asunto, texto, html }) {
  const info = await (await obtenerTransporte()).sendMail({
    from: process.env.CORREO_DE || "Dominio Seguro <alertas@dominio-seguro.local>",
    to: para,
    subject: asunto,
    text: texto,
    html,
  });
  const vista = nodemailer.getTestMessageUrl(info);
  if (vista) console.log(`Correo enviado. Vista previa: ${vista}`);
  return info;
}
