import test from "node:test";
import assert from "node:assert/strict";
import { enviarCorreo } from "../src/integrations/mailer.js";

test("con RESEND_API_KEY envía por la API HTTPS de Resend", async (t) => {
  process.env.RESEND_API_KEY = "re_clave_de_prueba";
  t.after(() => delete process.env.RESEND_API_KEY);
  const llamada = t.mock.method(globalThis, "fetch", async () => ({ ok: true, json: async () => ({ id: "abc" }) }));

  await enviarCorreo({ para: "ana@ejemplo.com", asunto: "Hola", texto: "texto" });

  assert.equal(llamada.mock.callCount(), 1);
  const [url, opciones] = llamada.mock.calls[0].arguments;
  assert.equal(url, "https://api.resend.com/emails");
  assert.equal(opciones.headers.Authorization, "Bearer re_clave_de_prueba");
  assert.deepEqual(JSON.parse(opciones.body).to, ["ana@ejemplo.com"]);
});

test("si Resend responde con error, enviarCorreo falla", async (t) => {
  process.env.RESEND_API_KEY = "re_clave_de_prueba";
  t.after(() => delete process.env.RESEND_API_KEY);
  t.mock.method(globalThis, "fetch", async () => ({ ok: false, status: 403 }));

  await assert.rejects(() => enviarCorreo({ para: "ana@ejemplo.com", asunto: "Hola", texto: "t" }), /Resend respondió 403/);
});
