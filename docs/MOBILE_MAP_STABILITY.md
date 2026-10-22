# 手機 sheet 與地圖穩定性（2026-10-22）

使用者回報 iPhone 17 Pro／iOS 27.0.1，頁面自動重載約兩次後 Safari 顯示重複發生問題。截圖顯示原上方控制列壓縮地圖；不以截圖單獨判定崩潰原因。

## 手機版面

手機 M1 搜尋、垃圾種類、篩選及可暫停提醒回到底部 sheet 的可捲動區域；把手與「附近的桶」標題維持可見。收起時控制項也隨 sheet 收起，完整地圖上方只留圖例。半開／全開／收起與鍵盤操作保持，桌面控制列仍在地圖上方。360／390px 的半開 sheet 保留一筆完整清單，小螢幕可捲動或展開。

## 排查與調整

- 新增全市 681 桶、130 場所代表點的重載／切頁檢查。初始 WebKit 檢查在第二輪附近出現 `ResizeObserver loop completed with undelivered notifications`，接著等待地圖 canvas 逾時。這不是 iPhone 的作業系統崩潰紀錄，無法直接證明為同一根因。
- 清單吉祥物原本每列含八個隱藏動畫影格，雖不播放仍會插入 DOM。靜態吉祥物現在只產生靜態 SVG；地圖互動標記仍保留動畫。此處先以單列測試重現 8 個影格，再驗證修正後為 0；同一全市 WebKit 重載測試由逾時改善為約 15 秒通過。
- 尺寸監聽只處理非零且真正改變的尺寸，移到下一個 animation frame 更新 Leaflet；卸載時取消回呼。sheet 尺寸相同時不重複更新 React state。
- 手機 canvas 像素密度上限 1.5；調整前量測約 2.626，調整後約 1.5。限制背景 worker 為一個、圖磚快取為 32 張／兩個縮放層級，使用 low-power context。桌面維持原解析度。設定使用 [MapLibre MapOptions](https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapOptions/)。
- 地圖瀏覽只掛載視野及小幅緩衝範圍內的標記，移動時更新；選中及目前鍵盤聚焦的標記保持，不因裁切／群聚而失去焦點；先群聚再掛載，避免同時插入全市桶的 SVG。完整清單、全市搜尋、Bin ID、來源及場所代表點語意保持；歷史展示不套用視野裁切。
- 一般重新整理／離開文件時透過 `pagehide` 立即釋放地圖；SPA 卸載同樣釋放，清理可重複呼叫。BFCache 保留頁面時不破壞可恢復的實例。
- WebGL 建立失敗、context lost 或底圖來源逾時時，切換不需 WebGL 的 OpenStreetMap 圖磚；不自動重載網頁。保留桶、清單及署名，明示已切換；替代服務仍需要網路且不保證可用。遵守 [OSM 圖磚政策](https://operations.osmfoundation.org/policies/tiles/)，只取目前視野圖磚，不做全市預抓或離線下載。自動測試攔截此服務。

## 驗證方法與界線

`tests/mobile-map-stability.spec.ts` 檢查全市清單在重複重載／切頁後仍完整、每次只有一層底圖、離頁無 canvas、手機解析度上限，以及強制 WebGL 失敗後仍可反覆使用地圖。WebKit 重載會將測試攔截的已取消請求回報為 access-control 訊息，僅排除這種已確認的取消訊息；仍檢查每輪完整 681 筆、其餘 JS 錯誤、尺寸迴圈及 page crash。

可用 `BINSOON_WEBKIT=1 npm run test:e2e -- tests/mobile-map-stability.spec.ts --project=mobile` 驗證 WebKit；需先安裝 Playwright WebKit。這是桌面 WebKit 引擎與手機尺寸，並非使用者的 iOS 27.0.1 實機。真實 Safari 的崩潰是否解除，仍需在部署新版後以原裝置重試。


最終 WebKit 四項檢查全通過（19.2 秒）；重載情境為三輪重新整理及切頁，涵蓋多次地圖建立／釋放。前幾輪測試也辨識出外部資源 `load` 等待問題，最終以 DOMContentLoaded 加實際清單／底圖斷言驗證，不用第三方下載完成作為網頁健康標準。

相關地圖／M flow 檢查先執行 54 項，其中 53 通過；一個既有斷言在縮放後仍要求保留視野外地標，已改在縮放前驗證地標外觀。靜態吉祥物調整後再複測 22 項，21 通過，發現手機鍵盤焦點會被視野裁切移除，已修正為保留聚焦標記並只複測該案例。未執行整套前端測試。

最後鍵盤焦點案例桌面／手機 2 項全通過（27.3 秒）。返回清單先縮小讓原目標重新進入視野，再驗證輪詢維持焦點；不要求保留已離開視野且未聚焦的標記。最終型別、資料檢查、build、diff 檢查通過。改動保留在 `codex/mobile-sheet-map-stability`，未推送或部署；本機 build 預覽仍為 http://127.0.0.1:4173/#map。
