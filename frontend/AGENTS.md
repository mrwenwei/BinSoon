# 前端工作指示

修改前先讀 [共用領域與資料限制](../docs/PROJECT_CONTEXT.md) 與 [V0／PM 規格來源](../docs/FRONTEND_V0.md)。本週以 Issue #1 的位置展示驗收為準，完整 PM 原型保留作後續範圍討論。

- React 共用 UI 放 components，靜態資料及篩選放 data，地圖生命週期與空間顯示放 map。
- 保留兩種資料粒度、來源及精度；稱 811 筆位置紀錄，reported_count 維持周邊統計。資料更新透過 data:generate，不手改快照。
- Leaflet 座標順序為 latitude、longitude；JSON 使用 numeric longitude、latitude。150m 圈僅為直線參考。
- 調整底圖時保留完整署名並確認來源可用；標記需可區分兩類資料，清單提供鍵盤可操作的替代入口。
- 此 V0 使用靜態資料獨立運行。登入、回報、投票、感測器、即時桶況及後端 API 變更須另有需求。
- 完成修改執行 typecheck、data:check、build 與 test:e2e；視覺修改檢視桌面及手機畫面。回報實體手機或外部服務仍未驗證之處。
