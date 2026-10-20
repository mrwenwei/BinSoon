# 前端工作指示

修改前先讀 [共用領域與資料限制](../docs/PROJECT_CONTEXT.md) 與 [目前 A flow 範圍](../docs/A_FLOW.md)。查閱初版需求時再讀 [V0／PM 規格來源（歷史）](../docs/FRONTEND_V0.md)。

- 視覺與元件規範見 [設計系統 v1](../docs/DESIGN_SYSTEM.md)：只用 src/styles/tokens.css 的 token、橘色不做按鈕、桶況三態與雙桶對照集中在 data/binState.ts、data/api.ts 與 components/binVisual.ts。
- React 共用 UI 放 components，靜態資料及篩選放 data，地圖生命週期與空間顯示放 map。
- 保留兩種資料粒度、來源及精度；稱 811 筆位置紀錄，reported_count 維持周邊統計。資料更新透過 data:generate，不手改快照。
- Leaflet 座標順序為 latitude、longitude；JSON 使用 numeric longitude、latitude。地圖只標示位置，選取時聚焦並高亮標記。
- 調整底圖時保留完整署名並確認來源可用；標記需可區分兩類資料，清單提供鍵盤可操作的替代入口。
- 前端使用靜態位置與本機示意資料獨立運行；串接真實服務或變更後端 API 須有明確需求。
- 完成修改執行 typecheck、data:check、build 與 test:e2e；視覺修改檢視桌面及手機畫面。回報實體手機或外部服務仍未驗證之處。
