// 版本號由 build.sh 自動更新；版本一變，舊快取會被清掉
const VERSION = "20261003234109";
const CACHE = "vocab4500-" + VERSION;
const FILES = ["./", "./index.html", "./manifest.webmanifest", "./icon-180.png", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
// 有網路：先抓最新版並存進快取；沒網路或太慢：用快取
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const net = fetch(e.request, { cache: "no-cache" }).then(res => {
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    });
    const timeout = new Promise(r => setTimeout(r, 3000, null));
    try {
      const res = await Promise.race([net, timeout]);
      if (res) return res;
    } catch (_) {}
    const hit = await cache.match(e.request, { ignoreSearch: true }) ||
                (e.request.mode === "navigate" ? await cache.match("./index.html") : null);
    return hit || net;
  })());
});
