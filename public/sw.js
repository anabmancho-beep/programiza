// Programiza: permite abrir y recargar la app sin conexión.
const CACHE = "programiza-v1";
const SHELL_FALLBACKS = ["/hoy", "/inicio", "/"];

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // nunca se guardan datos del servidor ni de la IA
  if (url.pathname.startsWith("/_serverFn") || url.pathname.startsWith("/api/")) return;

  if (req.mode === "navigate") {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await fetch(req);
        if (res.ok) cache.put(url.pathname, res.clone());
        return res;
      } catch {
        const hit = await cache.match(url.pathname);
        if (hit) return hit;
        for (const p of SHELL_FALLBACKS) { const r = await cache.match(p); if (r) return r; }
        return new Response("<h1>Sin conexión</h1><p>Abre Programiza una vez con conexión.</p>", { headers: { "content-type": "text/html; charset=utf-8" } });
      }
    })());
    return;
  }

  // Archivos de la app (código, estilos, fuentes, imágenes): red primero, copia si no hay conexión.
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch {
      const hit = await cache.match(req);
      if (hit) return hit;
      throw new Error("offline");
    }
  })());
});
