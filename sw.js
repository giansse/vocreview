// 由 tools/build.py 產生 sw.js；v4500 與 20261105073102 會被替換
const ID = "v4500";
const CACHE = ID + "-" + "20261105073102";
const FONTS = ID + "-fonts";
// 舊版快取名稱，清掉
const LEGACY = { v4500: ["vocab4500-"], vessay: ["essay-"], vunits: ["units-"] }[ID] || [];
const FILES = ["./", "./index.html", "./manifest.webmanifest", "./icon-180.png", "./icon-192.png", "./icon-512.png"];
self.addEventListener("install", e => {
  // cache: "reload"：一定跟網站拿最新的，不用瀏覽器暫存的舊檔
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(u => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => (k.startsWith(ID + "-") && k !== CACHE && k !== FONTS) || LEGACY.some(p => k.startsWith(p))).map(k => caches.delete(k))
  )).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.open(FONTS).then(async c => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      const res = await fetch(e.request); c.put(e.request, res.clone()); return res;
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  if (url.pathname.endsWith("/version.json")) { e.respondWith(fetch(e.request, { cache: "no-store" })); return; }   // 版本檢查：永遠問網站，不存
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const net = fetch(e.request, { cache: "no-cache" }).then(res => { if (res.ok) cache.put(e.request, res.clone()); return res; });
    const timeout = new Promise(r => setTimeout(r, e.request.mode === "navigate" ? 8000 : 3000, null));   // 4500 頁面超過 1 MB，給網路多一點時間
    try { const res = await Promise.race([net, timeout]); if (res) return res; } catch (_) {}
    const hit = await cache.match(e.request, { ignoreSearch: true }) ||
                (e.request.mode === "navigate" ? await cache.match("./index.html") : null);
    return hit || net;
  })());
});
