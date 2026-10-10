# 面試展示指南

## 90 秒展示

1. 打開作品：「這是一個空間型協作工具，不是另一個會議連結列表。進入就能看到完整辦公室。」
2. 操作角色、切換 Focus room，開 focus mode：「滑鼠、鍵盤和房間快捷入口都能完成同一工作。」
3. 修改名字、送出訊息：「Demo 資料有標示，Demo 訊息只保留本機；Live 訊息等待伺服器確認，不把假在線人數當成真實用戶。」
4. 在公開版 Invite people → Open a second guest，或開兩個瀏覽器視窗，在同一 workspace URL 進入 live mode，示範同步聊天和視訊邀請。另一端同意後才擷取裝置。
5. 打開 Behind the build 再返回原 workspace：「我不只是換框架，而是把資料驗證、身份來源、生命週期和產品呈現重新拆清楚。」返回保留房間與模式，不宣稱保留訪客身份或通話。

## 可以深入談的決策

- **Next.js 不等於所有內容都需要 SSR。** 此作品主體高度互動，所以採 client boundary；外殼、SEO metadata 和案例頁在 build 時產生，可免費靜態部署。
- **Bun 有實際用途。** 同一工具管理套件、跑測試、執行本機 WebSocket server；不用為了履歷多列幾個服務而引入 Express、額外獨立資料庫、Redis。
- **伺服器是身份的權威。** Client 只能送動作，不能指定聊天 sender。嚴格 Zod schema 把偽造欄位攔在邊界。
- **Cloudflare 而不是常駐 VPS。** Worker 同時服務靜態網站與同源 WebSocket，Durable Object 可休眠並從 attachment／temporary SQLite history 還原。
- **即時不是永久儲存。** 資料有最大筆數，最後一位離線就清空；這是零成本客人展示的產品選擇，不是企業級持久化方案。
- **WebRTC 的現實限制。** Signaling 不等於媒體傳輸。STUN 不保證所有網路互通；TURN 要考慮流量和部署成本，不宣稱永久免費視訊平台。
- **可及性不是補丁。** 原生 dialog 管焦點、label 綁定輸入、live region 宣告更新、room shortcut 不要求精準點擊、reduce-motion 支援。
- **漂亮插畫也要遵守幾何。** 參考 Gather／WorkAdventure 的可讀性原則，但不複製素材；原創 AI-assisted 2D 插畫存在專案內，家具與植物刻意不擋人，僅保留辦公室邊界與隔間牆；同一幾何同時供前端與伺服器驗證，測試每個房間的出生點可通行。

## 不要宣稱的事

- 沒有量測就不要寫「效能提升 80%」「百萬並發」。
- Guest link 不是安全登入；不可稱作已具企業級權限。
- Axe 自動測試通過不等於完整 WCAG 認證。
- 一對一實測成功不保證跨 NAT 或企業防火牆成功。
- AI-assisted 插畫不要說成自己手繪；設計方向、整合、geometry 與優化可以如實解說。
- 這份重構由 AI 協助。建議自己閱讀測試、改一個功能並解釋邊界，讓面試官看到你真正理解的部分。

## 有證據的改善（2026-10-10）

- **不是只測 CSS 數值。** 地圖 regression 先重現 320／390px 右側裁切，再測完整 floorplan、130% zoom 左右邊可捲到並能點擊移動，以及 reset 後不造成整頁 overflow。
- **測試真正的非同步競態。** 讓第一通 `createOffer` 永遠 pending，遠端掛斷仍須立即釋放 tracks；第二通不等待第一通就能建立。延遲的舊 end／decline 和舊 Promise rejection 不得清理新通話。使用假攝影機／麥克風，不代表所有真實網路都可接通。
- **少做重複工作，不增加架構。** `Intl.DateTimeFormat` 共用一份，而非每列重建 locale formatter。Bun 1.4 的 2,000 次相同時間格式化，三次本機比較為 188.53／283.26／543.53ms → 5.69／4.60／18.12ms，輸出逐一相同。測試包含 sample marker 與超出 Date 範圍 fallback。這是受當時機器負載影響的微測試，不是 LCP／INP 或整站加速比例。[MDN 說明](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toLocaleTimeString) 也建議大量重複格式化時共用 formatter。
- **廣播一次序列化。** Cloudflare presence 的 unit spy 確認同 workspace 多個收件人只做一次 `JSON.stringify`，payload 一致、其他 workspace 不收。32 人全員 20Hz 移動的靜態模型由 20,480 降到 640 次序列化／秒；這是模型，不是線上壓測，也不減少 incoming WebSocket message 配額。
- **流程要真的接通。** 在 Demo 按 Open a second guest，原分頁也轉入同一個 live workspace；兩個頁面真人 chat 同步有 regression test，不把開新頁當作功能完成。
- **聊天不搶走閱讀位置。** 測試 100 則 bounded history、其他 channel 更新、People、手機隱藏／顯示與明確 Jump to latest；也驗證單一 Tab stop、方向鍵、Home／End 和可聚焦 panel。
- **送達確認不能清錯草稿。** mode／channel 各自保留草稿 revision；測試延遲 ACK、編輯後回到同樣文字，以及實際 hook 在 mode 切換前清理窗口收到匹配 ACK。最後一項刻意注入事件時序，不宣稱自然網路常發生這個順序。
- **先量測再 memo。** 固定 100 則訊息、20Hz 鍵盤移動與模擬 WebSocket own-echo，三輪 Chromium CDP Script CPU 中位數為 2.923 → 1.669 ms／實際 move；獨立診斷確認 101 次移動的 timestamp formatter 存取由 20,200 次降到 0。比較版本為 `448f56e` → `bec39fb`；0 訊息控制組也下降，before 範圍 2.193–3.787 ms／move，不能將全部差異歸因 memo。兩版均無長任務或聊天 DOM 寫入、frame p95 同為 16.7–16.8ms；這證明減少重複工作，不代表整站速度或 INP 改善。
- **初始化不是假可操作。** 靜態輸出的辦公室在 URL context 初始化前用原生 inert 阻止互動，避免慢速 JavaScript 載入時跳到預設房間。Regression 刻意暫停 script 請求，實際點擊 footer 不能啟動 stale link；放行後才驗證原 workspace／mode 與案例頁往返。這不是把 retry 成功當成修復。
- **載入提示與預取也要遵守 context。** 2026-10-11 複驗：同一個預覽保留原插畫與 inert，現有 status pill 在初始化時顯示 Preparing，並在 inert 外提供輔助科技 status。Production 網路觀察先重現 4 個 stale `studio-team/demo` 請求（2 HEAD、2 tree GET），依 [Next Link 官方預取語義](https://nextjs.org/docs/app/api-reference/components/link#prefetch)，只在初始化完成後恢復預設預取；不把這少量請求減少宣稱為 LCP／INP 改善。測試要求正確 workspace／mode 的 notes RSC GET 在點擊前回 200，避免關掉所有預取也能通過。
- **來電也可能晚於離開。** 同一 JavaScript task 透過真正 hook client 同步注入合法 invite 與 caller-removal presence，先重現仍出現 A guest is calling，再驗證[Effect Event 的最新 committed 值](https://react.dev/reference/react/useEffectEvent)所提供的 peer list 阻止過期來電、保留 Live 且沒有媒體 capture。這是刻意建立的 React batching regression，不宣稱測得自然網路發生率。
- **驗證內容可見，而非只看導覽標籤。** 手機從 Conversations 用抽屜切到 Team，曾出現 breadcrumb 正確但 Directory 被舊 mobile tab 隱藏；regression 先重現 hidden，再驗證 Team 和 Office 兩條入口真正顯示內容。只需同步現有 tab state，不增加導覽框架。
- **失敗提示要在操作所在的視窗。** Live 斷線時 profile 不能送出，原本只顯示被 native dialog 擋在背景的提示。測試關閉真正的 client socket、暫時拒絕重連，驗證 modal 內錯誤、姓名／顏色草稿保留與 profile 未假更新；允許原生重連後，同一個未關閉的 modal 能重新儲存。
- **操作語意與真實結果一致。** 依 [WAI Button Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/)，Focus 用固定名稱與 pressed；Mute／Unmute、鏡頭開／關則顯示下一步動作，不混用 pressed。雙 guest regression 觀察原生假裝置 tracks，驗證 audio／video 的 enabled 雙向切換、互不影響及掛斷後 ended，而非只看按鈕文字。320／390px Chromium touch regression 實際點擊 44px 控制項邊緣，驗證縮放不移動人物、訊息只送一次與 dialog 能關閉；依 [W3C 44px 目標說明](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html) 改善幾個常用控制，並非宣稱整站 AAA、實體手機或跨 NAT 已驗證。
- **有效輸入不該破壞操作。** 用合法的 24 個連續 W，在 320×480／568×320 的雙 guest 流程重現 preview、sidebar、dialog、Team、聊天名稱的 overflow；以 `min-width: 0`／`overflow-wrap: anywhere` 修補，不縮短姓名或放寬 schema。測試完整作者與時間戳，以及未先自動捲動便位於 dialog 內的 Close；不是只斷言 CSS 宣告。
- **名牌也會影響真正的點擊範圍。** 320px touch／1440px mouse 回歸先重現：長名人物旁的合法地面點擊反而開啟 profile。只用原生 [CSS ellipsis](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/text-overflow) 限制地圖第一個字詞的顯示寬度，完整姓名仍供 profile／accessible name 使用，You／專注標記留在裁切外；修正後驗證真的移到目標，再點人物仍能開啟完整 profile。兩案各連跑三輪通過，320／390／1440px 的短名 label 尺寸與字型／顏色不變；不宣稱消除按鈕內所有透明空隙或已驗證實體手機。
- **原生 dialog 也有流程邊界。** 真人離線移除觸發按鈕後，Chromium 的 native close 可能仍把焦點留在已關閉 dialog 的 Close，而非 body。依 [WAI Dialog Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) 的邏輯流程原則，僅在 native return 失敗時回到地圖／People，隱藏時退到 main。另測 incoming 疊在未儲存 profile 上，Decline 後仍回原 input、草稿不丟失；離線通話的原生 synthetic audio／video tracks 都 ended，不以關閉 browser context 代替清理證據。六個回歸各連跑三輪通過；不宣稱其他瀏覽器、實體鍵盤或完整輔助科技驗證。
- **字型只載入需要的檔案，不犧牲設計。** 同樣的 Manrope／Urbanist 與字重改用兩個固定本機 variable WOFF2，移除兩個 Fontsource dependencies。公開站 `260bb43` → `6256280`，桌機 1440×1000／手機 viewport 390×844 各三輪 fresh context，實際字型請求每輪均由 7 → 2，`encodedBodySize` 總和由 92,724 → 52,588 B，少 40,136 B（43.3% **字型 bytes**，不是全站比例）。Browser regression 同時驗證 loaded faces／ranges、兩個同源請求與 CDP 實際 rendered glyph，沒有把 CSS 宣告成功當成字型載入成功。

### 字型改善的 cold-load 限制

上述量測使用 Chromium、關閉 browser cache、150ms 網路 latency、200,000 B/s download、93,750 B/s upload 與相對主機 CPU 4× throttle；每版桌機／手機各三輪，公開 edge cache、主機負載與 TTFB 未控制，不是實體手機或 field Core Web Vitals。

| 三輪中位數     | before 桌機 | after 桌機 | before 手機 | after 手機 |
| -------------- | ----------- | ---------- | ----------- | ---------- |
| LCP（ms）      | 4,740       | 2,644      | 2,968       | 3,564      |
| Startup CLS    | 0.000726    | 0.001816   | 0.000379    | 0.000390   |
| Font requests  | 7           | 2          | 7           | 2          |
| Font body（B） | 92,724      | 52,588     | 92,724      | 52,588     |

LCP candidate 仍是地圖，手機中位數反而較高；before 手機 2,692–4,100ms 與 after 2,868–3,608ms 範圍重疊，因此只宣稱確定的下載量減少，不把時間差全部歸因字型，也不宣稱 LCP／CLS 改善。Startup CLS 按 [官方 session-window 定義](https://web.dev/articles/cls) 從原始 layout-shift entries 計算，排除 recent input，取相鄰小於一秒、總長小於五秒窗口的最大值，而非把整次載入加總。所有十二次載入均無 page errors 或整頁 overflow；沒有互動樣本，不能推論 INP。

## 面試前自己練習

- 試著增加第五個房間，說明會改到哪些檔案。
- 關閉 realtime server，觀察重連與未送達狀態。
- 拒絕攝影機權限，觀察可恢復提示。
- 開兩個不同 workspace，驗證無法看到彼此。
- 解釋如果改成 10 人群組通話，為什麼目前的一對一設計不夠。
