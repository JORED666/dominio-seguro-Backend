// Express 4 no captura errores de funciones async: este envoltorio los pasa al manejador de errores
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
