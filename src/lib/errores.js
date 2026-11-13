// Error con código HTTP: los servicios lo lanzan y el manejador global lo convierte en respuesta
export class ErrorHttp extends Error {
  constructor(status, mensaje) {
    super(mensaje);
    this.status = status;
  }
}
