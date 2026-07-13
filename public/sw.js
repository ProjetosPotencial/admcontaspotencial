// Service worker minimo. Existe só pra deixar o app instalável (o Chrome
// exige um service worker registrado com um handler de fetch pra isso).
// Não guarda cache de páginas nem de dados - esse sistema mexe com
// aprovação e valor financeiro, então cache agressivo mostraria
// informação desatualizada, o que é pior que não ter cache nenhum.
// Só os ícones (estáticos, nunca mudam) ficam em cache.

const CACHE_ICONES = "potencial-contas-icones-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // só os ícones passam por cache - tudo o mais (páginas, API, dados) vai
  // sempre direto pra rede, sem interceptar.
  if (url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.open(CACHE_ICONES).then(async (cache) => {
        const emCache = await cache.match(event.request);
        if (emCache) return emCache;
        const resposta = await fetch(event.request);
        cache.put(event.request, resposta.clone());
        return resposta;
      })
    );
  }
});
