import jwt from "jsonwebtoken";

export function requiereAuth(req, res, next) {
  const cabecera = req.headers.authorization || "";
  const token = cabecera.startsWith("Bearer ") ? cabecera.slice(7) : null;
  if (!token) return res.status(401).json({ error: "No autenticado" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    req.usuario = { id: payload.sub, rol: payload.rol };
    next();
  } catch {
    res.status(401).json({ error: "Token inválido o expirado" });
  }
}
