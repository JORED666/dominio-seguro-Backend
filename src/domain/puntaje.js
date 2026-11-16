// Puntaje ponderado por categorías.
// Cada categoría vale 0-100 y pesa según la propuesta (TLS 25, cabeceras 25, correo 20,
// exposición 20, similares 10). El puntaje total es el promedio ponderado de las categorías
// que SÍ se pudieron evaluar: una categoría sin datos no suma ni resta.

export const CATEGORIAS = [
  { id: "tls", nombre: "Cifrado (TLS)", peso: 25, fuentes: ["TLS"] },
  { id: "cabeceras", nombre: "Cabeceras de seguridad", peso: 25, fuentes: ["Cabeceras"] },
  { id: "correo", nombre: "Correo (SPF/DKIM/DMARC)", peso: 20, fuentes: ["Correo"] },
  { id: "exposicion", nombre: "Exposición", peso: 20, fuentes: ["Exposición", "Reputación", "Subdominios"] },
  { id: "similares", nombre: "Dominios similares", peso: 10, fuentes: ["Similares"] },
];

const PUERTOS_PELIGROSOS = {
  21: "FTP", 23: "Telnet", 445: "SMB", 1433: "SQL Server", 3306: "MySQL", 3389: "Escritorio remoto",
  5432: "PostgreSQL", 5900: "VNC", 6379: "Redis", 9200: "Elasticsearch", 11211: "Memcached", 27017: "MongoDB",
};

export function calcularPuntaje({ cert, subdominios, errorCrt, reputacion, errorReputacion, exposicion, errorExposicion, correo, errorCorreo }) {
  let hayCritico = false;
  const hallazgos = []; // incluyen `resta` (puntos que quitan a su categoría) hasta el final

  const agregar = (categoria, severidad, titulo, descripcion, recomendacion, resta = 0) => {
    if (severidad === "critica") hayCritico = true;
    hallazgos.push({ categoria, severidad, titulo, descripcion, recomendacion, resta });
  };

  // --- TLS ---
  if (!cert) {
    agregar("TLS", "alta", "No se pudo establecer una conexión HTTPS",
      "El sitio no respondió en el puerto 443 o rechazó la conexión segura.",
      "Verifica que el sitio tenga HTTPS activo y un certificado instalado.", 100);
  } else {
    if (!cert.autorizado) {
      const vencido = (cert.error || "").toUpperCase().includes("EXPIRED");
      if (vencido) {
        agregar("TLS", "critica", "Certificado vencido",
          "El navegador mostrará una advertencia de sitio no seguro a tus visitantes.",
          "Renueva el certificado de inmediato con tu proveedor o con Let's Encrypt.", 100);
      } else {
        agregar("TLS", "alta", "Certificado no confiable",
          `El certificado no pasó la validación (${cert.error}).`,
          "Instala un certificado emitido por una autoridad reconocida y revisa la cadena completa.", 70);
      }
    } else if (cert.diasRestantes !== null && cert.diasRestantes < 15) {
      agregar("TLS", "media", `El certificado vence en ${cert.diasRestantes} días`,
        "Si no se renueva a tiempo, el sitio se marcará como inseguro.",
        "Renueva el certificado cuanto antes y activa la renovación automática.", 35);
    } else if (cert.diasRestantes !== null && cert.diasRestantes < 30) {
      agregar("TLS", "baja", `El certificado vence en ${cert.diasRestantes} días`,
        "Aún hay margen, pero conviene programar la renovación.", "Programa la renovación del certificado.", 15);
    } else {
      agregar("TLS", "info", "Certificado vigente", `Vence en ${cert.diasRestantes} días.`, "Sin acción necesaria.");
    }

    if (["TLSv1", "TLSv1.1"].includes(cert.protocolo)) {
      agregar("TLS", "alta", `Protocolo obsoleto (${cert.protocolo})`,
        "Las versiones antiguas de TLS tienen debilidades conocidas.",
        "Configura el servidor para usar TLS 1.2 o superior.", 40);
    }
  }

  // --- Subdominios (crt.sh): parte de la superficie expuesta ---
  if (errorCrt) {
    agregar("Subdominios", "info", "No se pudieron consultar los subdominios",
      "El servicio crt.sh no respondió a tiempo.", "Intenta el análisis de nuevo más tarde.");
  } else if (subdominios.length > 10) {
    agregar("Subdominios", "baja", `Se encontraron ${subdominios.length} subdominios`,
      "Mientras más subdominios haya, más puntos de entrada pueden quedar olvidados.",
      "Revisa cuáles ya no usas y elimínalos o desactívalos.", 10);
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
        "Revisa el servidor de inmediato: puede estar comprometido.", 100);
    } else if (f.is_abuse_listed || reputacion.risk_score >= 60) {
      agregar("Reputación", "alta", "La IP aparece en listas de abuso",
        "La IP del sitio está en listas públicas de amenazas (Spamhaus, FireHOL u otras).",
        "Investiga el origen del reporte y solicita la baja de la lista una vez corregido.", 60);
    } else if (f.is_tor || f.is_proxy) {
      agregar("Reputación", "media", "La IP está asociada a proxy o red Tor",
        "Las IP anónimas suelen estar bloqueadas por servicios de seguridad.",
        "Verifica que el sitio no se aloje en un proxy abierto.", 30);
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
    const expuestos = (exposicion.ports || []).filter((p) => PUERTOS_PELIGROSOS[p]);
    if (expuestos.length) {
      const lista = expuestos.map((p) => `${p} (${PUERTOS_PELIGROSOS[p]})`).join(", ");
      agregar("Exposición", "alta", "Servicios sensibles expuestos a internet",
        `Se detectaron puertos que normalmente no deben ser públicos: ${lista}.`,
        "Cierra estos puertos en el firewall o limítalos a IP de confianza.", Math.min(70, expuestos.length * 35));
    }
    const cves = exposicion.vulns || [];
    if (cves.length) {
      agregar("Exposición", "alta", `${cves.length} vulnerabilidades conocidas asociadas`,
        `Shodan asocia a esta IP: ${cves.slice(0, 5).join(", ")}${cves.length > 5 ? "…" : ""}.`,
        "Actualiza el software de los servicios expuestos.", 40);
    }
    if (!expuestos.length && !cves.length) {
      agregar("Exposición", "info", "Sin servicios sensibles ni vulnerabilidades detectadas",
        exposicion.sinDatos ? "Shodan no tiene datos de esta IP." : `Puertos visibles: ${(exposicion.ports || []).join(", ") || "ninguno"}.`,
        "Sin acción necesaria.");
    }
  }

  // --- Correo: SPF, DMARC y DKIM ---
  if (errorCorreo) {
    agregar("Correo", "info", "No se pudo revisar la configuración de correo",
      "El DNS no respondió a tiempo.", "Intenta el análisis de nuevo más tarde.");
  } else if (correo) {
    // Si el dominio no recibe correo, la falta de SPF/DMARC pesa menos (aun así conviene protegerlo)
    const sinMx = !correo.recibeCorreo;
    const { spf, dmarc } = correo;

    if (sinMx) {
      agregar("Correo", "info", "El dominio no tiene servidor de correo (MX)",
        "No recibe correo, pero igual pueden suplantarlo para enviar mensajes falsos.",
        "Si no lo usas para correo, publica SPF con -all y DMARC con p=reject.");
    }

    if (!spf.presente) {
      agregar("Correo", sinMx ? "media" : "alta", "No tiene registro SPF",
        "Sin SPF cualquiera puede enviar correo haciéndose pasar por tu dominio.",
        "Publica un registro TXT que empiece con v=spf1 e indique tus servidores de envío.", sinMx ? 20 : 40);
    } else if (spf.multiples) {
      agregar("Correo", "media", "Hay más de un registro SPF",
        "Con varios registros SPF los receptores lo tratan como error y lo ignoran.",
        "Une todo en un solo registro SPF.", 25);
    } else if (spf.todo === "+") {
      agregar("Correo", "alta", "SPF permite enviar a cualquiera (+all)",
        "El registro autoriza a cualquier servidor, así que no protege nada.",
        "Cambia el final del registro a -all o ~all.", 60);
    } else if (spf.todo === "?") {
      agregar("Correo", "media", "SPF no toma postura (?all)",
        "El registro no indica qué hacer con los remitentes no autorizados.",
        "Cambia el final del registro a -all.", 25);
    } else if (spf.todo === "~") {
      agregar("Correo", "baja", "SPF marca como sospechoso, pero no rechaza (~all)",
        "Es una configuración aceptable, aunque -all es más estricta.",
        "Cuando estés seguro de tus servidores de envío, cambia a -all.", 10);
    } else if (spf.todo === "-" || spf.redirect) {
      agregar("Correo", "info", "SPF configurado", spf.redirect && !spf.todo ? "Delega a otro dominio con redirect=." : "Rechaza a los remitentes no autorizados.", "Sin acción necesaria.");
    } else {
      agregar("Correo", "media", "El registro SPF no termina con una regla (all)",
        "Sin una regla final, los remitentes no listados quedan sin definir.",
        "Termina el registro con -all.", 25);
    }

    if (!dmarc.presente) {
      agregar("Correo", sinMx ? "media" : "alta", "No tiene registro DMARC",
        "Sin DMARC los receptores no saben qué hacer con el correo falso que usa tu dominio.",
        "Publica un TXT en _dmarc con v=DMARC1; p=none; rua=mailto:tu@correo y endurece la política con el tiempo.", sinMx ? 20 : 40);
    } else if (dmarc.politica === "none") {
      agregar("Correo", "media", "DMARC solo monitorea (p=none)",
        "Recibes reportes, pero el correo falso no se bloquea.",
        "Cuando los reportes salgan limpios, cambia a p=quarantine y luego p=reject.", 25);
    } else if (dmarc.pct < 100) {
      agregar("Correo", "baja", `DMARC solo se aplica al ${dmarc.pct}% del correo`,
        "El resto del correo falso no recibe la política.", "Sube pct a 100.", 10);
    } else {
      agregar("Correo", "info", `DMARC activo (p=${dmarc.politica || "?"})`, "Los receptores aplican tu política.", "Sin acción necesaria.");
    }

    if (!sinMx) {
      if (correo.dkim.length) {
        agregar("Correo", "info", "DKIM detectado", `Selectores encontrados: ${correo.dkim.join(", ")}.`, "Sin acción necesaria.");
      } else {
        agregar("Correo", "info", "No se detectó DKIM con los selectores comunes",
          "El selector de DKIM es privado: puede existir con otro nombre, por eso no resta puntos.",
          "Verifica en tu proveedor de correo que la firma DKIM esté activada.");
      }
    }
  }

  // --- Puntaje por categoría y total ponderado ---
  // Una categoría se evalúa solo si su fuente principal respondió (las demás aún no existen)
  const evaluada = {
    tls: true, // sin HTTPS también es un resultado: la categoría queda en 0
    exposicion: Boolean((reputacion && !errorReputacion) || (exposicion && !errorExposicion)),
    correo: Boolean(correo && !errorCorreo),
  };

  const categorias = CATEGORIAS.map((c) => {
    const resta = hallazgos.filter((h) => c.fuentes.includes(h.categoria)).reduce((s, h) => s + h.resta, 0);
    const puntaje = evaluada[c.id] ? Math.max(0, 100 - resta) : null;
    return { id: c.id, nombre: c.nombre, peso: c.peso, puntaje };
  });

  const usadas = categorias.filter((c) => c.puntaje !== null);
  const pesoTotal = usadas.reduce((s, c) => s + c.peso, 0);
  let puntaje = pesoTotal ? Math.round(usadas.reduce((s, c) => s + c.peso * c.puntaje, 0) / pesoTotal) : 0;
  if (hayCritico) puntaje = Math.min(puntaje, 59); // tope por hallazgo crítico

  // `resta` es interno: no se guarda en la base ni se envía
  return { puntaje, categorias, hallazgos: hallazgos.map(({ resta, ...h }) => h) };
}

export function nivelDePuntaje(puntaje) {
  if (puntaje >= 80) return "bueno";
  if (puntaje >= 50) return "mejoras";
  return "critico";
}
