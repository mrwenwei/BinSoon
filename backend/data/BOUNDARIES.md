# Demo 行政區檢查資料

- 提供機關：臺北市政府民政局。
- 資料集：[臺北市區界圖](https://data.gov.tw/dataset/121199)。
- [原始 SHP ZIP](https://data.taipei/api/dataset/1601ef3a-c253-4988-b047-943d9e786143/resource/d8b7eb29-136f-49fc-b14b-3489d3656122/download)。
- 下載日期：2026-10-18；資料集下載標題為「臺北市區界圖_20220915」，ZIP 內檔案時間為 2024-09-16，並非即時區界。
- 授權：政府資料開放授權條款第 1 版。
- ZIP SHA256：`77bcc347b503b8ff8a43f7e1afaaedb18877a6222282587b145adaba69afd2d9`。
- `taipei_districts.geojson`：依原始 `.prj` 從 TWD97 轉為 EPSG:4326，保留全部頂點，僅保存行政區名稱。轉換工具使用 pyshp、pyproj；它們只用於一次性圖資轉換，不是 API runtime 依賴。
- 重建：`uv run --with pyshp --with pyproj python scripts/convert_boundaries.py /path/to/download.zip`。

Seed 使用 PostGIS ST_Covers 檢查每個原始座標。非唯一匹配大安區時保存 boundary_warning，所有十個點仍屬 daan_phase1_10bins 情境，GET /bins?district=all&scenario_id=daan_phase1_10bins 不會依行政區排除任何點。Bin district 保存圖資判斷結果；無匹配時暫列大安區並警告。檢查僅為此十點 seed 使用，一般人工候選點 API 尚未實作區界驗證。

區界結果不代表符合交通安全、人行道淨寬、土地權屬或設置規範，所有點均須人工會勘。邊界附近點位應以最新圖資與主管機關確認。
