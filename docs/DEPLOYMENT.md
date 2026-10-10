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

2026-10-10 對話閱讀與房間導覽改善後：37 個單元測試、39 個 Cloudflare 本機 E2E、39 個公開站 E2E 通過；`bun run check`、public build 與 deploy dry-run 通過。公開版本 `fe01cfff-dc69-4fed-8062-fbecdc5a0643` 已確認承接 100% 流量，應用程式提交 `f672cdd`。聊天不再搶走歷史閱讀位置，mode／channel 草稿與延遲 ACK 分離，案例頁保留 workspace／mode；靜態辦公室在 URL context 初始化前原生 inert，避免誤用預設房間。

CI 曾暴露未等待初始化的兩項直接操作：受控暫停 scripts 時，Playwright `fill()` 回報完成但沒有 focus／input event，原生座標點擊也不取得地圖焦點；放行後草稿切換正常。兩個測試只新增可操作 boundary，保留原有斷言、timeout 與 retry 設定，沒有移除啟動前 blocked-click regression。初始化／導覽與受影響測試分別連跑五輪通過；修正後 [CI `9e273cf`](https://github.com/Metricra-code/modern-office/actions/runs/38063533485) 首次執行 38 項 E2E 通過、1 項 public-only 入口按設定略過，無重試或 flaky；公開站再跑受影響三項亦通過。

部署後以 curl 核對 32 個 HTML 引用／驗收資產與端點，均 HTTP 200，公開 HTML 含初始化保護；hashed 資產／HTML 快取策略維持正確。現代瀏覽器初始 9 scripts 為 187,161 B gzip，地圖維持 162,696 B，這不是整站加速比例或實際瀏覽器總下載量。公開版本的獨立診斷使用 100 則訊息與合法模擬 WebSocket：100 次移動、101 次移動＋own-echo 均不重複存取 timestamp formatter，聊天／插畫 DOM mutations 與 movement interval 重裝也為 0。三輪 CPU 比較與負載限制記錄於 `docs/INTERVIEW.md`；不宣稱 LCP／INP 或所有 NAT 已驗證。

2026-10-10 手機導覽／斷線 profile／字型載入改善後：`bun run check`（37 個單元測試）、public build、deploy dry-run、42 個 Cloudflare 本機 E2E、42 個公開站 E2E 通過。公開版本 `261ba8ab-45bd-418b-9269-47c7d2bbd492` 已確認承接 100% 流量，應用程式提交 `6256280`。[該版 CI](https://github.com/Metricra-code/modern-office/actions/runs/38064832596) 首次執行 41 項 E2E 通過、1 項 public-only 入口按設定略過，沒有重試或 flaky。手機從 Conversations 選 Team／Office 會顯示目標內容；離線 profile 保留姓名／顏色草稿、在 modal 內提示，重連後原視窗可重試。

部署後以 curl 檢查 23 個 HTML 引用／驗收資產、health 與授權 notices，全數 HTTP 200；兩個字型和三份公開授權與本機檔案逐 byte 相同。Hashed 字型維持一年 immutable，HTML／地圖維持可重新驗證。沒有新增 npm 依賴、外部 runtime 字型請求或付費服務；兩個不再使用的 Fontsource packages 已移除。這不是跨 NAT 或完整 WCAG 認證，既有開發工具鏈警示仍須追蹤。

桌機／手機各三輪 cold-load，before 和 after 每版各六次，實際字型請求每輪由 7 → 2、字型 body 由 92,724 → 52,588 B；維持原本字型與字重。手機 LCP 中位數並未改善，量測數據與限制記錄於 `docs/INTERVIEW.md`，不以字型 bytes 減量代替全站性能宣稱。公開桌機與手機畫面亦已檢視，沒有明顯字型 fallback、控制項重疊或整頁 overflow。

2026-10-11 初始化／手機分頁／來電競態改善：`bun run check`（37 個單元測試）、public build、deploy dry-run、46 個 Cloudflare 本機 E2E、46 個公開站 E2E 通過。公開版本 `09449758-c051-4c1e-986b-04925465fb35` 已確認承接 100% 流量，應用程式提交 `e9478ef`。[該版 CI](https://github.com/Metricra-code/modern-office/actions/runs/38066732001) 首次執行 43 項 E2E 通過、3 項 production-only 入口／預取測試按設定略過，沒有重試或 flaky。預取的 demo／live 案例在本機正式環境各連跑三次通過；初始化、手機分頁與 batched call race 亦各連跑三次通過。

初始化時保留地圖預覽，以現有 pill 顯示 Preparing，inert 外提供 status；房間確認後才恢復 Next 預取。手機 Team／Office 分頁名稱與內容一致，最新 peers 阻止已離開者的過期來電。暫停 scripts 的 1440／390／320px 預覽，以及手機 Team 畫面已實際檢視；沒有 page errors 或整頁 overflow。這不是實體觸控或 screen-reader 認證；本輪沒有更換插畫、字型、加入 npm 依賴或付費服務。

部署後以 curl 核對 23 個 HTML 引用／驗收資產與端點均 HTTP 200，初始化 status 和 inert 已存在公開 HTML；hashed 資產與 HTML／地圖快取策略維持正確。初始 9 scripts 為 187,220 B gzip（上一版 187,148 B，增加 72 B），地圖維持 162,696 B。這不是 bundle 減量或 LCP／INP 加速宣稱；本輪主要減少錯誤 context 的預取並改善使用流程。

後續文件提交的 [CI `cbdb937`](https://github.com/Metricra-code/modern-office/actions/runs/38067025341) 雖顯示 success，鍵盤 tab 測試第一次失敗、retry 才通過，不能當成 clean run。受控暫停 scripts 可重現：SSR 的三個 tabindex 斷言已通過，但 native inert 下 `.focus()` 返回後 activeElement 仍為 BODY，ArrowLeft 不會選到 People；放行並等待 context-ready 後立即可聚焦／切換。只為該測試新增初始化 boundary，保留全部鍵盤斷言、timeout 與 retry；startup regression 同時驗證初始化前鍵盤不能啟動、之後可操作。Bun 開發與 Cloudflare 本機環境的兩個受影響案例各連跑五次通過。公開應用程式不需改動或重新部署。

2026-10-11 手機觸控／媒體按鈕語意改善：`bun run check`（37 個單元測試）、public build、deploy dry-run、50 個 Cloudflare 本機 E2E、50 個公開站 E2E 全數通過。公開版本 `5fa78fb1-cb89-4842-9bda-de9ddbe69db5` 已確認承接 100% 流量，應用程式提交 `88d05fb`。[該版 CI](https://github.com/Metricra-code/modern-office/actions/runs/38068636525) 首次執行 47 項 E2E 通過、3 項 production-only 入口／預取測試按設定略過，沒有重試或 flaky。

公開舊版的 320／390px 實測：menu／close 32px、send 27px、zoom 25px；更新後這幾個控制項均為實際 44×44px，1440px 桌面尺寸不變。Chromium touch emulation 在按鈕邊緣操作 menu、三個 zoom、send 和 close，驗證無 overlap／overflow、縮放不移動人物、只送一則訊息及正常關閉 dialog；兩個尺寸與 Focus／媒體控制各連跑三輪通過。另人工檢查辦公室、composer、invite 和通話畫面，320／390px 的通話按鈕列能正常換行，較長的鏡頭動作文字不溢出；媒體 regression 驗證原生 synthetic audio／video tracks 的 enabled 切換與 ended 清理。不代表實體手機、真實硬體、完整 WCAG 或所有 NAT 已驗證。

部署後 23 個 HTML 引用／驗收資產與端點均 HTTP 200，快取策略維持正確；初始 9 scripts 為 187,123 B gzip、地圖仍為 162,696 B。未新增依賴或付費服務，也不將這次小幅 byte 差異宣稱為 LCP／INP 改善。

2026-10-11 長名稱／離線 dialog 焦點改善：`bun run check`（37 個單元測試）、public build、deploy dry-run、56 個 Cloudflare 本機 E2E、56 個公開站 E2E 全數通過。公開版本 `d481be37-a677-4bef-9688-3e74c69ccbc0` 已確認承接 100% 流量，應用程式提交 `74ef12d`。[該版 CI](https://github.com/Metricra-code/modern-office/actions/runs/38070879343) 首次執行 53 項 E2E 通過、3 項 production-only 入口／預取測試按設定略過，沒有重試或 flaky。

六個新回歸在 Bun 開發環境各連跑三輪通過：320×480／568×320 的完整長名稱仍可儲存／同步，profile、sidebar、Team、聊天作者和 dialog 標題不再撐出相鄰控制；Close 在自動捲動前就位於 dialog／viewport 內。真人離開後，native close 若仍留焦點在已關閉 dialog，才回到地圖／People；People 因手機尺寸隱藏時退到 main。Incoming 疊在未儲存 profile 上，Decline 後原 input 焦點與草稿保留；兩條原生 synthetic tracks 在 caller context 仍開啟時已 ended。Cloudflare 本機的正常桌面工作台／invite 與上述兩種小尺寸畫面亦已檢視，未見整頁或 dialog 水平溢出。不代表其他瀏覽器、實體手機、作業系統鍵盤、真實硬體或所有 NAT 已驗證。

部署後 23 個 HTML 引用／驗收資產與端點均 HTTP 200，hashed 資產與 HTML 快取策略維持正確。初始 9 scripts 為 187,306 B gzip（前版 187,123 B），沒有新增依賴或付費服務；本輪修補流程與版面，不宣稱 LCP／INP 或 bundle 減量。

2026-10-11 地圖長名點擊修補：`bun run check`（37 個單元測試）、public build、deploy dry-run、58 個 Cloudflare 本機 E2E、58 個公開站 E2E 通過。公開版本 `36404e98-6281-4182-bd81-3a1297cc3015` 已確認承接 100% 流量，應用程式提交 `1b4b463`。[該版 CI](https://github.com/Metricra-code/modern-office/actions/runs/38072341674) 首次執行 55 項 E2E 通過、3 項 production-only 測試按設定略過，沒有重試或 flaky。

320px touch／1440px mouse 的兩個新回歸各連跑三輪通過：人物旁的合法地面點擊不再被長名撐大的透明按鈕攔截，實際位置到達目標；再點人物仍開啟完整 profile，You／專注標記保留。公開 320／390／1440px 畫面已檢視，短名的尺寸、字型與顏色不變；仍保留人物原本的最小點擊區，不宣稱消除所有透明空隙或已驗證實體手機。部署後 23 個資產／端點均 HTTP 200、快取策略正確；初始 9 scripts 為 187,321 B gzip（前版 187,306 B）。沒有新增依賴或付費服務，不宣稱 LCP／INP 改善。

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
