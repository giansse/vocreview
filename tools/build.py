#!/usr/bin/env python3
"""把 sources/<app>.html（artifact 原始 HTML）包成可離線、會自動更新的 PWA。
用法：python3 tools/build.py 4500 | essay | units | all
"""
import pathlib, re, sys, time

ROOT = pathlib.Path(__file__).resolve().parent.parent
APPS = {
    "4500":  {"out": ".",     "theme": "#1f4569", "short": "4500多義"},
    "essay": {"out": "essay", "theme": "#a8781f", "short": "作文單字"},
    "units": {"out": "units", "theme": "#3f7a4e", "short": "單元單字"},
}

HEAD = '''<meta name="theme-color" content="{theme}">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon-192.png">
<link rel="apple-touch-icon" href="icon-180.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="{short}">
<style>.pwa-toast{{position:fixed;left:50%;bottom:calc(16px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);background:var(--ink,#1c2430);color:var(--surface,#fff);font:600 13px/1.4 "Noto Sans TC",system-ui,sans-serif;padding:10px 16px;border-radius:999px;box-shadow:0 6px 20px rgba(0,0,0,.25);z-index:100;max-width:calc(100% - 32px);text-align:center}}.pwa-status{{display:block;margin-top:4px}}.pwa-update{{border:0;cursor:pointer;background:var(--accent,#1f4569);color:#fff;z-index:101}}</style>
'''

TAIL = '''<div class="pwa-toast" id="pwaToast" hidden></div>
<button type="button" class="pwa-toast pwa-update" id="pwaUpdate" hidden>有新版本 · 點這裡更新（紀錄都會保留）</button>
<script>
(function () {
  const BUILT = "__BUILT__";   // 這一版的版本號；version.json 比它新就代表網站上有新版
  const toast = msg => { const t = document.getElementById("pwaToast"); t.textContent = msg; t.hidden = false; setTimeout(() => t.hidden = true, 4000); };
  const footer = document.querySelector(".sidebar-footer") || document.getElementById("footer");
  const status = document.createElement("span"); status.className = "pwa-status";
  if (footer) footer.appendChild(status);
  const paint = () => status.textContent = (navigator.onLine ? "已連線 · 會自動抓新版" : "離線中 · 使用已存的版本") + " · 版本 " + BUILT.slice(2, 8) + "-" + BUILT.slice(8, 12);
  paint(); addEventListener("online", paint); addEventListener("offline", paint);
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
  const ss = { get: k => { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) {} } };
  let reg = null, reloading = false, hiddenAt = 0;
  const btn = document.getElementById("pwaUpdate");
  // 先讓新版的 service worker 裝好（它會把新版存進手機），再重新載入
  async function apply() {
    if (reloading) return; reloading = true; btn.textContent = "更新中…";
    try {
      if (reg) {
        await reg.update();
        const sw = reg.installing || reg.waiting;
        if (sw) await new Promise(res => { sw.addEventListener("statechange", () => { if (sw.state === "activated" || sw.state === "redundant") res(); }); setTimeout(res, 10000); });
      }
    } catch (e) {}
    location.reload();
  }
  btn.onclick = apply;
  async function latest() {
    try { const r = await fetch("version.json?t=" + Date.now(), { cache: "no-store" }); return r.ok ? String((await r.json()).v || "") : ""; } catch (e) { return ""; }
  }
  // auto：剛打開，或在背景放很久才回來 → 直接更新；否則在下面顯示「點這裡更新」
  async function check(auto) {
    if (!navigator.onLine) return;
    if (reg) reg.update().catch(() => {});
    const v = await latest();
    if (!v || v <= BUILT) return;
    if (auto && ss.get("pwaReloadedFor") !== v) { ss.set("pwaReloadedFor", v); return apply(); }
    btn.hidden = false;
  }
  navigator.serviceWorker.register("sw.js").then(r => { reg = r; check(true); });
  addEventListener("online", () => check(false));
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { hiddenAt = Date.now(); return; }
    check(hiddenAt && Date.now() - hiddenAt > 10 * 60 * 1000);
  });
  let had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!had) { had = true; return; }
    if (!reloading) btn.hidden = false;
  });
})();
</script>
'''

def build(app):
    cfg = APPS[app]
    src = (ROOT / "sources" / f"{app}.html").read_text(encoding="utf-8")
    if "</head>" not in src or "</body>" not in src:
        sys.exit(f"sources/{app}.html 不是完整的 HTML（缺 </head> 或 </body>）")
    out = src.replace("</head>", HEAD.format(**cfg) + "</head>", 1)
    i = out.rindex("</body>")
    v = time.strftime("%Y%m%d%H%M%S")
    out = out[:i] + TAIL.replace("__BUILT__", v) + out[i:]
    out = re.sub(r"<html>", '<html lang="zh-Hant">', out, count=1)
    d = ROOT / cfg["out"]
    (d / "index.html").write_text(out, encoding="utf-8")
    (d / "version.json").write_text('{"v": "%s"}\n' % v)
    sw = (ROOT / "tools" / "sw.template.js").read_text().replace("__ID__", "v" + app).replace("__VERSION__", v)
    (d / "sw.js").write_text(sw)
    print(f"built {app} -> {cfg['out']}/index.html  version {v}")

targets = list(APPS) if sys.argv[1:] == ["all"] else sys.argv[1:]
if not targets or any(t not in APPS for t in targets):
    sys.exit(__doc__)
for t in targets:
    build(t)
