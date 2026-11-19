// Arma el correo de alerta (asunto, texto plano y HTML) a partir de los cambios detectados.
const esc = (t) =>
  String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const SEVERIDAD = { critica: "Crítica", alta: "Alta", media: "Media", baja: "Baja", info: "Info" };

export function armarCorreo({ dominio, nombreUsuario, cambios, urlPanel }) {
  const signo = cambios.delta > 0 ? "+" : "";
  const asunto = `Alerta de seguridad en ${dominio}: ${cambios.puntajeAntes} → ${cambios.puntajeAhora}`;

  const lineasNuevos = cambios.nuevos.map(
    (h) => `- [${SEVERIDAD[h.severidad]}] ${h.titulo}\n  ${h.descripcion}\n  Qué hacer: ${h.recomendacion}`
  );
  const lineasResueltos = cambios.resueltos.map((h) => `- ${h.titulo}`);

  const texto = [
    `Hola ${nombreUsuario},`,
    "",
    `Detectamos cambios en la seguridad de ${dominio}.`,
    `Puntaje: ${cambios.puntajeAntes} → ${cambios.puntajeAhora} (${signo}${cambios.delta})`,
    ...(lineasNuevos.length ? ["", "Problemas nuevos:", ...lineasNuevos] : []),
    ...(lineasResueltos.length ? ["", "Problemas resueltos:", ...lineasResueltos] : []),
    "",
    `Revisa el detalle en tu panel: ${urlPanel}`,
    "",
    "Dominio Seguro",
  ].join("\n");

  const itemsNuevos = cambios.nuevos
    .map(
      (h) =>
        `<li><strong>[${esc(SEVERIDAD[h.severidad])}] ${esc(h.titulo)}</strong><br>${esc(h.descripcion)}<br><em>Qué hacer:</em> ${esc(h.recomendacion)}</li>`
    )
    .join("");
  const itemsResueltos = cambios.resueltos.map((h) => `<li>${esc(h.titulo)}</li>`).join("");

  const html = `<div style="font-family:Arial,sans-serif;max-width:560px">
<h2>Alerta de seguridad en ${esc(dominio)}</h2>
<p>Hola ${esc(nombreUsuario)}, detectamos cambios en tu dominio.</p>
<p><strong>Puntaje:</strong> ${cambios.puntajeAntes} → ${cambios.puntajeAhora} (${signo}${cambios.delta})</p>
${itemsNuevos ? `<h3>Problemas nuevos</h3><ul>${itemsNuevos}</ul>` : ""}
${itemsResueltos ? `<h3>Problemas resueltos</h3><ul>${itemsResueltos}</ul>` : ""}
<p><a href="${esc(urlPanel)}">Ver el detalle en tu panel</a></p>
<p style="color:#666">Dominio Seguro</p>
</div>`;

  return { asunto, texto, html };
}
