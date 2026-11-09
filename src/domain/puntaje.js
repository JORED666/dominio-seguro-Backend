// Puntaje PROVISIONAL del avance: parte de 100 y resta según los hallazgos.
// Más adelante se reemplaza por el sistema de categorías y pesos de la propuesta.
export function calcularPuntaje({ cert, subdominios, errorCrt, reputacion, errorReputacion, exposicion, errorExposicion }) {
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

  // --- Reputación de la IP (IP Score API) ---
  if (errorReputacion) {
    agregar("Reputación", "info", "No se pudo consultar la reputación de la IP",
      "El servicio de reputación no respondió.", "Intenta el análisis de nuevo más tarde.");
  } else if (reputacion) {
    const f = reputacion.flags || {};
    if (f.is_botnet_c2) {
      agregar("Reputación", "critica", "La IP figura como servidor de control de botnet",
        "La IP del sitio aparece en listas de Abuse.ch como servidor C2 activo.",
        "Revisa el servidor de inmediato: puede estar comprometido.", 60);
    } else if (f.is_abuse_listed || reputacion.risk_score >= 60) {
      agregar("Reputación", "alta", "La IP aparece en listas de abuso",
        "La IP del sitio está en listas públicas de amenazas (Spamhaus, FireHOL u otras).",
        "Investiga el origen del reporte y solicita la baja de la lista una vez corregido.", 30);
    } else if (f.is_tor || f.is_proxy) {
      agregar("Reputación", "media", "La IP está asociada a proxy o red Tor",
        "Las IP anónimas suelen estar bloqueadas por servicios de seguridad.",
        "Verifica que el sitio no se aloje en un proxy abierto.", 15);
    } else {
      const aloja = f.is_datacenter ? " La IP pertenece a un proveedor de nube/datacenter, lo cual es normal." : "";
      agregar("Reputación", "info", "La IP no tiene mala reputación conocida",
        `No aparece en las listas de amenazas consultadas.${aloja}`, "Sin acción necesaria.");
    }
  }

  // --- Exposición de servicios (Shodan InternetDB) ---
  if (errorExposicion) {
    agregar("Exposición", "info", "No se pudo consultar la exposición de servicios",
      "InternetDB no respondió o se alcanzó su límite de uso.", "Intenta el análisis de nuevo más tarde.");
  } else if (exposicion) {
    const PELIGROSOS = { 21: "FTP", 23: "Telnet", 445: "SMB", 1433: "SQL Server", 3306: "MySQL",
      3389: "Escritorio remoto", 5432: "PostgreSQL", 5900: "VNC", 6379: "Redis", 9200: "Elasticsearch",
      11211: "Memcached", 27017: "MongoDB" };
    const expuestos = (exposicion.ports || []).filter((p) => PELIGROSOS[p]);
    if (expuestos.length) {
      const lista = expuestos.map((p) => `${p} (${PELIGROSOS[p]})`).join(", ");
      agregar("Exposición", "alta", "Servicios sensibles expuestos a internet",
        `Se detectaron puertos que normalmente no deben ser públicos: ${lista}.`,
        "Cierra estos puertos en el firewall o limítalos a IP de confianza.", Math.min(30, expuestos.length * 15));
    }
    const cves = exposicion.vulns || [];
    if (cves.length) {
      agregar("Exposición", "alta", `${cves.length} vulnerabilidades conocidas asociadas`,
        `Shodan asocia a esta IP: ${cves.slice(0, 5).join(", ")}${cves.length > 5 ? "…" : ""}.`,
        "Actualiza el software de los servicios expuestos.", 20);
    }
    if (!expuestos.length && !cves.length) {
      agregar("Exposición", "info", "Sin servicios sensibles ni vulnerabilidades detectadas",
        exposicion.sinDatos ? "Shodan no tiene datos de esta IP." : `Puertos visibles: ${(exposicion.ports || []).join(", ") || "ninguno"}.`,
        "Sin acción necesaria.");
    }
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
