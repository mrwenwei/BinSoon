# 桶詳情背景更新穩定性

2026-10-20。使用 diagnosing-bugs 的可重現測試驗證，起點為 `f14f7a2`。沒有改後端、定期更新頻率或寫入雲端資料。

## 原因與修正

原本 `useApi` 在每次前景定期讀取時都會設 loading，雖然保留既有資料，`LoadState` 仍插入載入段落。最小重現測得桶況卡片 top 從 234px 變成 270.390625px；回應後再移回。先只修正提示後，版面測試通過，但原地圖標記節點仍被移除，確認另有地圖重建問題。

`useApi` 現在額外回傳 refreshing，`LoadState` 在已有資料的更新期間不插入載入段落，首次載入、失敗與過期資料提示保留。原本 loading／ETag／權限守門語意不變，不讓衝突後尚未讀完資料的命令提前恢復。

`LocationMap` 改為依 kind／UUID 保留並更新標記；只在圖示外觀改變時 setIcon，消失的點才移除。只有位置集合／座標改變才 fitBounds，選取 ID／座標改變才對焦；相同桶的資料輪詢不重設視角。地圖清理時重設標記記錄，支援開發模式 effect 重新掛載。底圖來源與署名不變。

## 驗證

`api-refresh.spec.ts` 使用 Playwright 操作實際頁面、攔截 HTTP 與控制定期更新：

- 保持回應未完成，確認卡片位置與既有標記節點持續保留；完成回應後仍保留。
- 後端滿度由 20% 改 30%，確認畫面更新數字，同時保留標記及使用者調整的縮放；保存桌面及 Pixel 7 截圖。

定向測試桌面／手機 4 項通過；typecheck、data:check、build 通過，資料仍為 811 = 681 桶位置＋130 場所代表點。桌面及 Pixel 7 截圖已人工檢視，保存於本機 `.scratch/refresh-visual/`，不提交暫存圖。

完整回歸於獨立 5174 Vite dev server 執行，**332 項全數通過（7.4 分鐘）**，涵蓋既有與新增 API 流程及歷史展示。使用與原 Playwright 設定相同的桌面／手機專案與兩個 workers，只更換測試伺服器與 baseURL；測試後移除暫時設定，5173 production preview 持續可用。首次完整執行誤用 production preview，因歷史入口未打包而中止；這些入口改在 dev server 重跑後全數通過，未為通過測試修改其斷言。

文件相對連結及 git diff 檢查通過，沒有保留 debug logs。Vite 主 bundle 大小提醒、既有 MapLibre／Leaflet 快速換頁 getZoom teardown 訊息仍存在，未在本次擴充其底圖生命週期。

這項修正處理 SPA 的定期更新。瀏覽器 F5 仍會重新載入整個應用與首次 API 資料，不能把它當作同頁背景更新。資料仍為 simulated；沒有新增前端假資料 fallback。真實手機及外部底圖網路品質未重新驗證。
