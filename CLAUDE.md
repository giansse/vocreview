# vocreview：單字 artifact 的離線 app

這個 repo 把三份單字 artifact 包成可離線、會自動更新的 PWA，透過 GitHub Pages 發布。

| app | 原稿 artifact | 原始檔 | 網址 |
|---|---|---|---|
| `4500` 4500 單字多義複習 | https://claude.ai/artifact/3jfJxjokFxKU5Hx2yMReSY | `sources/4500.html` | https://giansse.github.io/vocreview/ |
| `essay` 學測作文單字庫 | https://claude.ai/artifact/EmuWcXxKpR4zpYosZJ4QUV | `sources/essay.html` | https://giansse.github.io/vocreview/essay/ |
| `units` 單元單字庫 | https://claude.ai/artifact/1BS11fVDtv5LVg1GgBKm76 | `sources/units.html` | https://giansse.github.io/vocreview/units/ |

**artifact 是唯一的原稿。** 內容一律先改 artifact、發布，再同步到這裡。不要直接改 `index.html` 或 `sources/`。

## 同步流程（artifact 發布之後）

1. 讀取剛發布的 artifact 完整 HTML：Artifact 工具 `action: "read"`、`url` 用上表的網址、`path: "index.html"`。結果會告訴你檔案存在哪裡。
2. 把那個檔案覆蓋到 `sources/<app>.html`。
3. 執行 `python3 tools/build.py <app>`（`4500`、`essay`、`units` 或 `all`）。會重新產生該 app 的 `index.html` 和 `sw.js`，`sw.js` 的版本號一變，使用者手機連網時就會自動換新版。
4. 提交並推送到 `main`：
   ```sh
   git config user.name Claude
   git config user.email noreply@anthropic.com
   git add -A
   git commit -m "Sync <app>: <這次改了什麼>"
   git fetch origin main && git rebase origin/main
   git push origin HEAD:main
   ```
5. 跟使用者回報一句：已推上 GitHub，手機連網打開 app 會自動更新。

## 注意

- `sources/*.html` 必須是完整 HTML（有 `</head>` 和 `</body>`）；用 `path: "index.html"` 讀出來的就是。`build.py` 遇到不完整的檔案會直接停下。
- 新增 app：在 `tools/build.py` 的 `APPS` 加一筆，建立資料夾、`manifest.webmanifest` 和三個 icon（180 / 192 / 512 px），再把網址補進 README 和上表。
- GitHub Pages 從 `main` 分支根目錄發布，推上去後約一兩分鐘生效。
