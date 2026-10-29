// Puntaje PROVISIONAL del avance: parte de 100 y resta según los hallazgos.
// Más adelante se reemplaza por el sistema de categorías y pesos de la propuesta.
export function calcularPuntaje({ cert, subdominios, errorCrt }) {
  let puntaje = 100;
  let hayCritico = false;
  const hallazgos = [];

  const agregar = (categoria, severidad, titulo, descripcion, recomendacion, resta = 0) => {
    puntaje -= resta;
    if (severidad === "critica") hayCritico = true;
    hallazgos.push({ categoria, severidad, titulo, descripcion, recomendacion });
  };

  if (!cert) {
    agregar(
      "TLS", "alta", "No se pudo establecer una conexión HTTPS",
      "El sitio no respondió en el puerto 443 o rechazó la conexión segura.",
      "Verifica que el sitio tenga HTTPS activo y un certificado instalado.", 50
    );
  } else {
    if (!cert.autorizado) {
      const vencido = (cert.error || "").toUpperCase().includes("EXPIRED");
      if (vencido) {
        agregar(
          "TLS", "critica", "Certificado vencido",
          "El navegador mostrará una advertencia de sitio no seguro a tus visitantes.",
          "Renueva el certificado de inmediato con tu proveedor o con Let's Encrypt.", 60
        );
      } else {
        agregar(
          "TLS", "alta", "Certificado no confiable",
          `El certificado no pasó la validación (${cert.error}).`,
          "Instala un certificado emitido por una autoridad reconocida y revisa la cadena completa.", 30
        );
      }
    } else if (cert.diasRestantes !== null && cert.diasRestantes < 15) {
      agregar(
        "TLS", "media", `El certificado vence en ${cert.diasRestantes} días`,
        "Si no se renueva a tiempo, el sitio se marcará como inseguro.",
        "Renueva el certificado cuanto antes y activa la renovación automática.", 20
      );
    } else if (cert.diasRestantes !== null && cert.diasRestantes < 30) {
      agregar(
        "TLS", "baja", `El certificado vence en ${cert.diasRestantes} días`,
        "Aún hay margen, pero conviene programar la renovación.",
        "Programa la renovación del certificado.", 10
      );
    } else {
      agregar("TLS", "info", "Certificado vigente", `Vence en ${cert.diasRestantes} días.`, "Sin acción necesaria.");
    }

    if (["TLSv1", "TLSv1.1"].includes(cert.protocolo)) {
      agregar(
        "TLS", "alta", `Protocolo obsoleto (${cert.protocolo})`,
        "Las versiones antiguas de TLS tienen debilidades conocidas.",
        "Configura el servidor para usar TLS 1.2 o superior.", 20
      );
    }
  }

  if (errorCrt) {
    agregar(
      "Subdominios", "info", "No se pudieron consultar los subdominios",
      "El servicio crt.sh no respondió a tiempo.", "Intenta el análisis de nuevo más tarde."
    );
  } else if (subdominios.length > 10) {
    agregar(
      "Subdominios", "baja", `Se encontraron ${subdominios.length} subdominios`,
      "Mientras más subdominios haya, más puntos de entrada pueden quedar olvidados.",
      "Revisa cuáles ya no usas y elimínalos o desactívalos.", 5
    );
  } else {
    agregar("Subdominios", "info", `Se encontraron ${subdominios.length} subdominios`, "Cantidad razonable.", "Sin acción necesaria.");
  }

  puntaje = Math.max(0, Math.min(100, puntaje));
  if (hayCritico) puntaje = Math.min(puntaje, 59); // tope por hallazgo crítico
  return { puntaje, hallazgos };
}

export function nivelDePuntaje(puntaje) {
  if (puntaje >= 80) return "bueno";
  if (puntaje >= 50) return "mejoras";
  return "critico";
}
