# 地圖 V0 規格與討論來源

- 本次驗收範圍：[GitHub Issue #1](https://github.com/mrwenwei/BinSoon/issues/1)，保存 2026-10-18 使用者授權的需求。
- PM 完整原型：[智慧垃圾桶 介面流程（Web＋手機 Web）](https://claude.ai/artifact/Eng4CbzrW5vFfRyWWViHf8#page-ed25c7b30423)。可能需要受邀帳號查看；包含後續 A＋B 與其他營運頁面，不全部納入本次實作。
- 共用領域與來源資料：[PROJECT_CONTEXT.md](PROJECT_CONTEXT.md)。

本次先交付組員可瀏覽、討論的真實位置展示，10/20 初步展示、10/24 正式 Demo。完整 PM 原型中的桶況、即時百分比、登入、回報、投票、感測器及其他頁面均為後續討論，本次沒有將示意資料實作為真實功能。

## 驗收

- 同一張地圖呈現 811 筆位置紀錄：681 筆公布桶位置、130 筆場所代表點，綠色桶角色與紫色星星角色區別資料粒度。
- 可選全市、完整十二行政區及位置類型。預設全市；大安區共 65 筆（47＋18）。
- 點選標記或清單後查看名稱／地址、備註、numeric 經緯度、精度與來源追溯。場所周邊統計不展開為桶。
- 選取位置顯示半徑 150m 直線參考圈；不代表步行距離或服務範圍。
- 桌面雙欄、手機直向地圖與清單；底圖失敗時提示並保留位置查閱。
- React 元件、位置資料與 map 模組分離，獨立於 backend 開發及建置。

## 底圖

使用 [OpenFreeMap 官方 quick start](https://openfreemap.org/quick_start/) 的 Liberty style，搭配 [MapLibre 官方 Leaflet adapter](https://github.com/maplibre/maplibre-gl-leaflet)。OpenFreeMap 提供可公開使用的無 API key 底圖，保留其資料署名連結。詳見 [OpenFreeMap](https://openfreemap.org/)。像素角色為本專案自行繪製 SVG。
