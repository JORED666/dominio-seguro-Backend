import os, json, urllib.request
T = os.environ["TOKEN"]
def get(ruta):
    r = urllib.request.Request("http://localhost:3001" + ruta, headers={"Authorization": "Bearer " + T})
    d = json.load(urllib.request.urlopen(r))
    return d if isinstance(d, list) else next((v for v in d.values() if isinstance(v, list)), [])
FALSO = "00000000-0000-4000-8000-000000000000"
dom, sim = None, FALSO
for d in get("/api/dominios")[:10]:
    dom = dom or d["id"]
    s = get(f"/api/dominios/{d['id']}/similares")
    if s:
        dom, sim = d["id"], s[0]["id"]
        break
usr = next((u["id"] for u in get("/api/admin/usuarios") if u.get("correo") == "mfa@correo.com"), FALSO)
print("dominio:", dom, "| similar:", sim, "| usuario de prueba:", usr)

spec = json.load(urllib.request.urlopen("http://localhost:3001/api/openapi.json"))
spec["servers"] = [{"url": "http://localhost:9999"}]
ejemplos_param = {"id": dom, "similarId": sim}
cuerpos = {
    ("post", "/api/auth/registro"): {"nombre": "Prueba ZAP", "correo": "zap@ejemplo.com", "password": "ClaveLarga#2026"},
    ("post", "/api/auth/login"): {"correo": "zap@ejemplo.com", "password": "ClaveLarga#2026"},
    ("post", "/api/auth/mfa/verificar"): {"mfaToken": "x", "codigo": "123456"},
    ("post", "/api/auth/mfa/activar"): {"codigo": "123456"},
    ("post", "/api/auth/mfa/desactivar"): {"password": "x", "codigo": "123456"},
    ("post", "/api/dominios"): {"nombre": "ejemplo.com"},
    ("patch", "/api/dominios/{id}/similares/{similarId}"): {"propio": True, "revisado": True},
    ("patch", "/api/admin/usuarios/{id}"): {"rol": "usuario"},
}
def resolver(o):
    return spec["components"]["schemas"][o["$ref"].split("/")[-1]] if "$ref" in o else o
for ruta, ops in spec["paths"].items():
    for metodo, op in ops.items():
        if not isinstance(op, dict): continue
        for p in op.get("parameters", []):
            if p.get("name") in ejemplos_param:
                p["example"] = ejemplos_param[p["name"]]
                p.setdefault("schema", {})["example"] = ejemplos_param[p["name"]]
        ex = cuerpos.get((metodo, ruta))
        mt = op.get("requestBody", {}).get("content", {}).get("application/json")
        if ex and mt:
            mt["schema"] = {**resolver(mt["schema"]), "example": ex}
            mt["example"] = ex
json.dump(spec, open("docs/zap/openapi-zap.json", "w"))
print("spec listo")
