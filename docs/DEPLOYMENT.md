# 公開部署：靜態網站 + 真人連線

公開網址：[Modern Office](https://modern-office.traceai-api.workers.dev/)。目前已從帳號方案頁確認 Workers Free，沒有升級或新增付費 relay。

## Cloudflare Workers Free

`wrangler.jsonc` 將 Next.js 的 `out/` 與 WebSocket `/office` 部署在同一個 Worker：

- 平台提供 HTTPS／WSS 與 `workers.dev` 網域，不需要購買網域。
- SQLite Durable Object 用 Hibernation API 保留連線，閒置時不用維持 Bun process。
- 入口預設真人模式；每個新訪客建立自己的 workspace，分享連結才能進同一間辦公室。
- 邀請視窗的 **Open a second guest** 可讓面試官開第二分頁，自己測試移動、聊天與通話邀請。這是真正第二條連線，不是假在線人數。
- `?mode=demo` 是離線樣本模式；示範人物與訊息有明確標記。

需要自己的 Cloudflare 帳號與部署登入；**不需要在前端放 API key**。先確認 Workers 方案為 **Free**，不升級、不加信用卡。已有 Paid 帳號時，不能把新增 Worker 當成保證零費用的服務。

```bash
bun install --frozen-lockfile
bunx wrangler login
bun run check
bun run test:e2e
NEXT_PUBLIC_SITE_URL=https://modern-office.YOUR-SUBDOMAIN.workers.dev bun run deploy
```

`deploy` 使用 `build:public`，設定 `NEXT_PUBLIC_DEFAULT_MODE=live` 與同源 `/office`。`NEXT_PUBLIC_*` 在 Next build 時固定，修改後必須重新 build/deploy。

部署前可只做本機預檢，不更新雲端：

```bash
bun run build:public
bun run deploy:check
bun run dev:cloudflare    # http://127.0.0.1:3103
```

檢查 `GET /health`、两個相同 workspace 的 presence/chat、不同 workspace 的隔離與訪客離開清理。`wrangler deploy` 成功才算公開，不把 dry-run 說成已部署。

## 部署後驗收

### Calling 協定更新

2026-10-10 起，每一通 invitation 與後續 SDP／ICE／結束訊號必須帶同一個 UUID `callId`，避免前一通延遲訊號結束新通話。部署此更新後，已開啟的訪客分頁都應重新整理再試通話；新舊 calling frames 不互通。Bun 與 Cloudflare 對合法但缺少 ID 的舊呼叫明確提示 `Calling was updated. Reload this page before starting a call.`，不轉送該訊號，其他 presence／chat 維持可用。格式錯誤或偽造欄位仍是一般拒絕，不當成舊版本。

只對帶 fingerprint 的 `/_next/static/*` 設一年 `immutable` browser cache，依 [Cloudflare 官方 `_headers` 語法](https://developers.cloudflare.com/workers/static-assets/headers/#configure-custom-browser-cache-behavior)。HTML 與未 hash 的地圖沒有套用長效快取，避免部署後保留舊入口。測試截圖寫入 ignored 的 `test-results/`，一般驗收不再覆寫 Git 追蹤的作品圖片。

```bash
PLAYWRIGHT_BASE_URL=https://modern-office.YOUR-SUBDOMAIN.workers.dev bun run test:e2e
```

不要只檢查 `/health`：還要驗證實際 HTML 引用的 JS、CSS 和圖片、免註冊入口、第二位訪客與媒體清理。先前部署切換瞬間曾出現新舊 chunk 的短暫 404；確認新資產已可取用後，重新跑完整公開站驗收，不能把失敗的 smoke test 忽略成成功。

2026-10-09 驗收：27 個單元測試、15 個 Cloudflare 本機 E2E、15 個公開站 E2E 通過；format、lint、typecheck 與 production build 通過。公開版本：`dd9afa48-3dcc-4693-b49a-9649306a8ef4`。家具不擋路、牆面限制與第二位訪客的沙發座標同步均已驗證。E2E 視訊使用假攝影機／麥克風，未擷取真實裝置；不代表所有 NAT 都可連線。

2026-10-10 作品集發布前複驗：`bun run check`（含 27 個單元測試）、15 個公開站 E2E、public build 與 deploy dry-run 通過。人工驗證辦公室與案例頁可往返、Live workspace 可連線，該次瀏覽沒有 console errors/warnings。桌面與手機 viewport 的驗收使用 Chromium，沒有宣稱已驗證所有實體裝置或 Safari。

GitHub 發布前補齊 Lucide 完整授權 notices，未修改功能程式碼。公開站已更新至 `02d4afe5-7238-4cd4-82a8-c29595d9f9d3`，Cloudflare 確認承接 100% 流量；公開 notice 與安裝套件的 LICENSE byte-for-byte 一致，更新後 15 個公開站 E2E 再次通過。本機 Bun 的 14 個 E2E 通過，另 1 個僅針對公開站的入口測試按設定略過。

2026-10-10 UI／UX 與可靠性改善後複驗：35 個單元測試、25 個 Cloudflare 本機 E2E、25 個公開站 E2E 全數通過；Bun 開發環境 24 個 E2E 通過、1 個公開入口測試按設定略過。`bun run check`（format／lint／typecheck／test／build）、public build 與 deploy dry-run 通過。公開版本 `7f2bdb37-b2a3-41de-b535-919fad6c9afe`，程式提交 `448f56e`。

部署後檢查 22 個 HTML 引用／驗收資產與端點，均 HTTP 200；hashed JS／CSS／fonts 回傳 `public, max-age=31536000, immutable`，HTML 與未 hash 的地圖維持 `public, max-age=0, must-revalidate`。現代瀏覽器初始 9 scripts 為 189,531 B gzip（改善前 188,982 B，新增 call-ID 保護等程式後 +549 B），不含 `noModule` polyfill；這不是 bundle 減量的宣稱。地圖維持 162,696 B。人工公開瀏覽確認 320px 地圖完整、live 可連線；本機人工確認 130% 放大後能捲到右緣。沒有宣稱 LCP／INP、實體觸控裝置或所有 NAT 都已驗證；`bun audit` 的既有 dev-toolchain 警示仍存在。

## 已知開發工具鏈安全警示

2026-10-10 執行 `bun audit --json` 發現一項 high 警示：[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)，影響 `braces@3.0.3` 的深度巢狀 glob pattern。`bun why braces` 確認唯一路徑是 dev dependency `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces`；應用程式沒有把 URL、聊天或 WebSocket 輸入交給 glob。公開站使用靜態輸出與 Cloudflare Worker，不執行 ESLint 工具鏈。

官方 advisory 當日仍列出沒有修補版，`bun audit fix --dry-run` 也確認無可用修補版本；沒有忽略警示或盲目 override。這不是公開站已發現的可觸發漏洞，但依賴 audit **並非零警示**。處理不可信專案或 glob 設定前應重新檢查上游修補狀態。

## 免費配額不是無限

截至 2026-10-09，官方 [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) 與 [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/) 說明：

- 靜態資產請求免費；Worker Free 動態請求上限每日 100,000。
- Durable Object Free 每日 100,000 計費請求、13,000 GB-s duration；接收的 WebSocket 訊息按 20:1 折算請求，發送不另計請求。
- 超過 Free 配額會拒絕請求，不是自動轉付費；**這不適用已在 Paid 的帳號**。
- SQLite 儲存另有免費每日讀寫／容量限制；目前只在聊天時寫一列 bounded history，移動不寫 SQL。

專案另限制 32 guests/workspace、256 guests 全域、64 workspaces、100 recent messages、40 events/sec/socket、20KB payload 與 350ms chat cooldown。單一 coordinator 是作品的刻意規模上限，不宣稱企業級無限並發。Cloudflare 免費每日配額是帳號共用，不能保證一直可用。

## 內容與隱私

- Guest workspace link 是路由，不是身份驗證；知道連結的人可以加入，不要分享機密內容。
- 座標／名字／狀態存在連線 attachment；最近 100 則聊天暫存在 Durable Object SQLite，以跨休眠還原。最後一位 guest 離開就刪除該 workspace history，應用程式沒有聊天歸檔或復原功能。Cloudflare SQLite 的 [PITR](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/#pitr-point-in-time-recovery-api) 可保留過去 30 天復原資料，因此刪除不等於平台即時抹除；請勿輸入敏感資訊。
- Deployment 關閉應用 observability，程式不記錄名字、聊天或媒體內容；平台仍可能保有基礎設施紀錄。
- 精確同源 Origin 檢查與 Zod 驗證不等於 authentication，也不是完整的分散式 DDoS 防護。

## 視訊限制

一對一 WebRTC 使用公共 STUN，媒體直接在雙方瀏覽器之間傳送。雙方要同意相機／麥克風；初始化失敗、離線與結束通話均清理 tracks。

**公開 presence/chat 不依賴 TURN；跨網路視訊不是保證。** 對稱 NAT、企業防火牆可能需要 TURN。未自動註冊需要信用卡或超額計費的 relay。可選環境設定在 `.env.example`，正式產品應由服務端發短效 TURN 憑證，不將長效私人密碼放入 `NEXT_PUBLIC_*`。

[Cloudflare TURN pricing](https://developers.cloudflare.com/realtime/sfu/platform/pricing/) 有免費流量額度但超額計費；[Metered OpenRelay](https://www.metered.ca/tools/openrelay/) 有限額免費方案，需自行建立帳號。不能把任一服務稱作無限、永久零成本。

## 其他部署方式

本機仍可 `bun dev`（前端 3100、Bun WebSocket 3101），不需任何雲端帳號。

GitHub Pages 手動 workflow 保留供離線 Demo 使用；它不能執行 Bun／Durable Object。若部署到其他純靜態主機，應保持 demo 預設，或 build 時指定已部署的 `NEXT_PUBLIC_REALTIME_URL=wss://.../office`，並為後端設定精確 `ALLOWED_ORIGINS`。

`bun start` 只預覽 `out/`；不要使用 `next start`，因為此專案是 static export。
