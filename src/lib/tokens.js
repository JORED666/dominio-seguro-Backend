import { createHash, randomBytes } from "node:crypto";

// Token de refresco: aleatorio y opaco. En la base de datos solo se guarda su hash.
export const nuevoTokenRefresco = () => randomBytes(32).toString("base64url");
export const hashToken = (token) => createHash("sha256").update(token).digest("hex");
