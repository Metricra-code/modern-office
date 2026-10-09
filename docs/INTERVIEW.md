# 面試展示指南

## 90 秒展示

1. 打開作品：「這是一個空間型協作工具，不是另一個會議連結列表。進入就能看到完整辦公室。」
2. 操作角色、切換 Focus room，開 focus mode：「滑鼠、鍵盤和房間快捷入口都能完成同一工作。」
3. 修改名字、送出訊息：「展示資料有標示，展示訊息只保留本機；不把假在線人數當成真實用戶。」
4. 在公開版 Invite people → Open a second guest，或開兩個瀏覽器視窗，在同一 workspace URL 進入 live mode，示範同步聊天和視訊邀請。另一端同意後才擷取裝置。
5. 打開 Behind the build：「我不只是换框架，而是把資料驗證、身份來源、生命週期和產品呈現重新拆清楚。」

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

## 面試前自己練習

- 試著增加第五個房間，說明會改到哪些檔案。
- 關閉 realtime server，觀察重連與未送達狀態。
- 拒絕攝影機權限，觀察可恢復提示。
- 開兩個不同 workspace，驗證無法看到彼此。
- 解釋如果改成 10 人群組通話，為什麼目前的一對一設計不夠。
