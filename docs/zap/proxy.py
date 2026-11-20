import os, urllib.request, urllib.error
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

SALTAR = {"transfer-encoding", "connection", "keep-alive", "content-length"}

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send_response(self, code, message=None): self.send_response_only(code, message)  # sin Server ni Date propios
    def manejar(self):
        n = int(self.headers.get("Content-Length") or 0)
        cuerpo = self.rfile.read(n) if n else None
        h = {k: v for k, v in self.headers.items() if k.lower() in ("content-type", "authorization", "cookie")}
        if not any(k.lower() == "authorization" for k in h):
            h["Authorization"] = "Bearer " + os.environ["TOKEN_ZAP"]
        req = urllib.request.Request("http://localhost:3001" + self.path, data=cuerpo, headers=h, method=self.command)
        try:
            r = urllib.request.urlopen(req, timeout=120); estado, datos, cab = r.status, r.read(), r.headers.items()
        except urllib.error.HTTPError as e:
            estado, datos, cab = e.code, e.read(), e.headers.items()
        except Exception:
            estado, datos, cab = 502, b"", []
        with open("/tmp/proxy.log", "a") as f:
            f.write(f"{self.command} {self.path.split('?')[0]} {estado} auth=si\n")
        self.send_response(estado)
        for k, v in cab:
            if k.lower() not in SALTAR: self.send_header(k, v)
        self.send_header("Content-Length", str(len(datos))); self.end_headers(); self.wfile.write(datos)
    do_GET = do_POST = do_PATCH = do_PUT = do_DELETE = do_OPTIONS = do_HEAD = manejar

ThreadingHTTPServer(("0.0.0.0", 9999), H).serve_forever()
