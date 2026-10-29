import tls from "node:tls";

// Se conecta a la IP ya validada (evita DNS rebinding) usando el nombre como SNI
export function revisarCertificado(ip, host) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      { host: ip, port: 443, servername: host, rejectUnauthorized: false, timeout: 8000 },
      () => {
        const cert = socket.getPeerCertificate();
        const venceEn = cert.valid_to ? new Date(cert.valid_to) : null;
        const info = {
          protocolo: socket.getProtocol(),
          autorizado: socket.authorized,
          error: socket.authorizationError ? String(socket.authorizationError) : null,
          emisor: cert.issuer?.O || cert.issuer?.CN || "Desconocido",
          venceEn: venceEn ? venceEn.toISOString() : null,
          diasRestantes: venceEn ? Math.floor((venceEn - Date.now()) / 86400000) : null,
        };
        socket.end();
        resolve(info);
      }
    );
    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error("Tiempo agotado al conectar por HTTPS"));
    });
    socket.on("error", reject);
  });
}
