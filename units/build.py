# 用法：python3 units/build.py  （從 /home/claude/sources/units.html 產生 essay/index.html 與 sw.js）
import pathlib, time, re
here = pathlib.Path(__file__).parent
src = pathlib.Path("/home/claude/sources/units.html").read_text()
head = '''<meta name="theme-color" content="#3f7a4e">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon-192.png">
<link rel="apple-touch-icon" href="icon-180.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="單元單字">
<style>.pwa-toast{position:fixed;left:50%;bottom:calc(16px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);background:var(--ink,#1c2430);color:var(--surface,#fff);font:600 13px/1.4 "Noto Sans TC",system-ui,sans-serif;padding:10px 16px;border-radius:999px;box-shadow:0 6px 20px rgba(0,0,0,.25);z-index:100;max-width:calc(100% - 32px);text-align:center}.pwa-status{display:block;margin-top:4px}</style>
'''
tail = '''<div class="pwa-toast" id="pwaToast" hidden></div>
<script>
(function () {
  const toast = msg => { const t = document.getElementById("pwaToast"); t.textContent = msg; t.hidden = false; setTimeout(() => t.hidden = true, 4000); };
  const footer = document.querySelector(".sidebar-footer");
  const status = document.createElement("span"); status.className = "pwa-status";
  if (footer) footer.appendChild(status);
  const paint = () => status.textContent = navigator.onLine ? "已連線 · 會自動抓新版" : "離線中 · 使用已存的版本";
  paint(); addEventListener("online", paint); addEventListener("offline", paint);
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
  let had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register("sw.js").then(reg => {
    const check = () => reg.update().catch(() => {});
    addEventListener("online", check);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) check(); });
  });
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!had) { had = true; return; }
    toast("單元單字庫有新版本，下次打開就會是最新的");
  });
})();
</script>
'''
out = src.replace("</head>", head + "</head>", 1)
i = out.rindex("</body>")
out = out[:i] + tail + out[i:]
out = re.sub(r'<html>', '<html lang="zh-Hant">', out, count=1)
(here / "index.html").write_text(out)
v = time.strftime("%Y%m%d%H%M%S")
(here / "sw.js").write_text((here / "sw.template.js").read_text().replace("__VERSION__", v))
print("built", v)
