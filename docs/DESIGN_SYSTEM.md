# BinSoon 設計系統 v1（初步 design guideline）

2026-10-23 桶詳情抽屜＋配色 v4（`feat/bin-detail-sheet`）：手機桶詳情不再滿版，改在地圖下方抽屜原地顯示，取代下一段「M2 滿版」；地圖頁與步行導航共用 `useBottomSheet` 手勢。選中改為腳下像素橘底座＋十字定位線（取代圓環），選中桶放大 1.3 倍。建議點標記改 M3 虛線機器人外框；新增投票面板 `VotePanel` 與場所詳情 `PlacePanel`；分頁名「要桶投票」改「設桶投票」。橘色語意擴為「吃飽了」＋「你選的／你在哪」，不新增顏色。細則見第 1、2、5、7、8 節。

2026-10-22 第二輪 UI：投票 sheet 保持底部精簡面板（2026-10-23 起改為 `VotePanel`，見第 5 節）；V2 以四階段圓點進度卡呈現。U1 點數摘要與三個主要入口、U2 單列獎勵卡、U3 兩欄結果／按讚均沿用 chrome、mint、teal 與原字體 token。S2 結案單一 CTA，S3 站點操作在右欄，S4 月份欄位使用 min-inline-size:0 與容器寬度限制。移除這些頁面的通用提案／認養／兌換 footer，不更動主分頁。

2026-10-22 M1–M4：手機底部分頁為 52px 加 safe-area，圖示使用現有 map／pin／user 線條 SVG。M1 控制列單列排列，移除圖例；M2 為地圖下方抽屜（2026-10-23 起，原為滿版面板）與獨立薄荷認領橫條。M4 距離 banner、問題選中狀態用 mint／teal，拍照與送出仍用 teal。詳情入口只對 transform／opacity 使用約 220ms 過場，減少動態效果時停用。使用者已要求移除模擬揭露文字，下方相反敘述為歷史規格。

2026-10-21 B／C：共用三分頁依身份呈現市民地圖／投票／我的或清潔員工單／路線／榮譽榜；U1 採薄荷點數摘要與功能卡、U3／U4 沿用深色卡片與青綠 CTA。V1 建議點依新規格顯示支持率（「支持 95%」，為票數資訊，不是桶聚合數），S3 使用既有道路地圖與 teal 進度條。M1 上方搜尋／分類篩選浮層下設提示跑馬燈，可暫停及減少動態效果。詳見 [B／C](BC_FLOW.md)。

2026-10-21 M flow 導覽更新：正式入口採 `DemoNav`，手機底部三分頁、桌面頂部三分頁「地圖／設桶投票／我的」。頂部 Demo 身份切換取代漢堡，保留一鍵登入及角色首頁。使用既有 chrome、mint、teal token，底部分頁預留 safe-area，內容不被遮擋。下方第 8 節漢堡與無底部導覽為歷史展示規格；正式入口以 [M flow](M_FLOW.md) 為準，原 `AppNav` 僅供歷史展示。

2026-10-21 會員中心參考使用者提供的 P8／P9 截圖：薄荷等級摘要、三欄六級圓形徽章及集點說明，桌面及手機均為單欄堆疊。回報、點數歷史紀錄、兌換紀錄及通知以共用分頁列進入各自頁面，首頁不堆疊這四塊內容；目前分頁以 mint 底及 `aria-current=page` 標示，窄版換行。「兌換獎品」仍另開獨立頁面並使用二欄獎品卡。色彩使用既有 token。

2026-10-19 起前端全面換成設計者提供的「BinSoon 色票」。本文件是前端實作的規範與對照表；設計權威來源是設計者的 BinSoon 色票設計系統（README、tokens、MapMarker／StationCard／SingleBinCard／NearestList 元件說明）與 style-a／style-b 設計稿。兩者有出入時以設計系統 README 為準，並記錄在文末「待決事項」。

> **主題**：本文件第 1–8 節的深炭灰＋teal＋橘色選取描述的是 **night（原版）主題**。預設的 **day（日間像素）主題**配色、圓角、字體不同，見下方「主題（日間像素／夜間原版）」一節；兩者衝突時，day 以該節為準。

一句話：**任務控制台的骨架，加上像素電子雞的親切感。** 深炭灰的頂欄、面板和卡片，中間放灰綠色的地圖；青綠代表「可以去」，訊號橘代表「吃飽了」與「你選的／你在哪」（選中、焦點、導航路線，見第 1、2、7 節）。

## 1. 設計原則

1. **深炭灰骨架＋灰綠地圖。** 頂欄、卡片、圖例列用 `chrome`，面板和頁面底用 `panel`，輸入框用 `field`；地圖（含 MapLibre 底圖）用 `map` 系列。
2. **青綠是「去」，橘色是「吃飽了」或「你選的／你在哪」（night／原版適用；day 主題改為綠＝餓了、紅＝吃飽了、紫＝互動與選取，見「主題」一節）。** 主要行動一律 `teal`（文字 `text-on-light`）。`signal` 兩種語意靠形狀區分（配色 v4，不新增顏色）：
   - **填滿或大字＝吃飽了**：桶身、色帶、斜紋警示條、吃飽了的百分比與可丟數、吃飽了膠囊（橘框＋字＋像素小 z）。吃飽了每處至少兩個非顏色線索（字、小 z、斜紋、表情）。
   - **線或框＝選中／目前位置**：地圖選中底座與十字線、已選篩選膠囊 2px 外框、`--focus-ring`、`.text-button` 底線、清單剛看過列的左線、導航路線。
   - **永遠不做按鈕底色**，就算整張卡片是橘色，主按鈕仍是青綠。警示框不用橘（中性左框＋⚠）。投票面板不用橘。禁用紫色。
   - **例外**：底部分頁、頂部分頁、種類切換（`WastePicker`）的已選狀態維持青綠／原樣，不改橘。
   - **路線**用語意 token `--route`（指向 `signal`），需畫成深色外框（`--route-casing`＝`text-on-light`）的粗線以和吃飽了標記區分；路線程式一律引用 `--route`／`--route-casing`，不寫死色碼。
3. **用色塊和線分層，不用陰影。** 區塊分隔線 `divider`（2px）、清單列之間 `hairline`（1px）、卡片內 `line`（1px）。唯一例外是地圖電子雞的 2px 像素投影（MapMarker 規格）。
4. **薄荷底上不放 #4aba94 文字。** 薄荷底上的青綠文字一律用 `teal-on-mint`；一般文字用 `text-on-light`。
5. **失聯一定加虛線外框。** `status-offline` 灰與青綠亮度接近，不能只靠顏色。
6. **不放的東西：** MISSION、SYS、編號導覽、統計數字列（811／681／32）、DEMO FEED 標籤、卡片頂端 STATION／FULL 列。資料揭露（simulated、示意、demo_assumption）仍要保留，用小標或說明句呈現。
7. **手機優先（390×844）。** 先確保手機沒有橫向捲動、觸控目標至少 44px、輸入框字級 16px（避免 iOS 放大），再調桌面（1440×900）。

## 2. 色彩 token 與用途

所有顏色只來自 `frontend/src/styles/tokens.css`（設計系統產生、勿手改）。需要淡色時用 `color-mix()` 混 token，不寫死色碼。

| 角色 | Token | 用途 |
| --- | --- | --- |
| 深色骨架 | `chrome` #232826 | 頂欄、卡片、圖例列、縮放鈕、點數按鈕底 |
| | `panel` #181d1c | 頁面底、桌面左側面板、側邊選單 |
| | `field` #222827 | 輸入框、深色面板裡的次要色塊 |
| 薄荷 | `mint` #bfd9c5 | Logo 底塊、認養橫條、起點、新設小牌、會員等級卡、清潔隊篩選列、投票提示條；已選篩選與 `.tabs` 不再用 mint（改 `signal` 框） |
| 地圖 | `map`、`map-block`、`map-park`、`map-road` | 地圖底、街區、公園、道路（MapLibre 自訂底圖也用這組） |
| 文字（深底） | `text`、`text-muted`、`text-body` | 主要文字與大數字、次要文字與英文小標、卡片說明句 |
| 文字（淺底） | `text-on-light`、`text-on-light-muted` | mint／map／teal／signal 底上的文字；電子雞外框 |
| 線 | `line`、`line-control`、`line-input`、`divider`、`hairline` | 卡片內線、外框按鈕、輸入框框線、區塊分隔、清單細線 |
| 主要行動 | `teal` #4aba94 | 主按鈕、目前分頁（底部／頂部分頁）、編號與分鐘數、可以丟、導航中我的位置、投票支持弧 |
| | `teal-on-mint` #1d6650 | 薄荷底上的青綠文字 |
| 吃飽了／你選的 | `signal` #f2673a、`signal-on-light` | 吃飽了（填滿、大字）：桶身、色帶、斜紋、滿度數字、吃飽了膠囊。你選的（線、框）：選中底座、已選篩選框、焦點、連結底線、清單選中列左線。`signal-on-light`：淺底上的橘字、地圖十字定位線 |
| 導航路線 | `route`（＝`signal`）、`route-casing`（＝`text-on-light`） | 市民步行導航路線主線與深色外框；不做按鈕、不用在桶況 |
| 桶況 | `status-hungry`、`status-full`、`status-offline` | 電子雞身體、色帶、圖例 |
| 電子雞 | `mascot-eye`、`mascot-blush`、`place` | 眼白、腮紅、場所代表點身體 |
| 焦點 | `focus-ring`（＝`signal`） | 鍵盤焦點 2px 外框 |

`styles.css` 開頭另有少量**衍生 token**（全部由上表混出）：`--tint-teal`、`--tint-signal`、`--tint-place`（卡片內淡色底）、`--scrim`（側邊選單遮罩）、`--marker-shadow`（電子雞投影）；`--pixel-z` 是吃飽了像素小 z 的 mask 形狀（顏色取 `currentColor`），不是顏色。舊樣式沿用的 `--ink`、`--green`、`--muted`、`--paper` 只是指回色票的別名，新程式不要再用。

**允許的非 token 色碼（例外清單）**

- `<meta name="theme-color">`：瀏覽器頂欄色無法讀 CSS 變數，值寫死在 `frontend/index.html` 的 inline script 與 `src/theme.ts` 的 `THEME_COLORS`（day #ffffff＝`--px-card`、night #232826＝`chrome`），須與頁首底色一致。
- MapLibre 底圖與 Leaflet 路線、QR Code 需要實際色值：`src/map/basemapStyle.ts` 的 `token()` 在執行時讀 `:root` 的 token；水域色由 `map-park` 混 `teal-on-mint` 算出。程式內沒有寫死色碼。

## 主題（日間像素／夜間原版）

- **定位**：`day`＝日間像素皮膚（米色地面、白卡片、圓角、Nunito，詳見 [PIXEL_SKIN.md](PIXEL_SKIN.md)）；`night`＝夜間原版，就是本文件第 1–8 節描述的設計系統（深炭灰、teal、橘色選取）。
- **機制**：`<html data-theme="day|night">`，預設 `day`。`frontend/index.html` 的 inline script 在 render 前設定：先看網址 `?theme=night|day`（會覆寫並寫入 localStorage），否則讀 localStorage key `binsoon-theme`，都沒有就 day。執行期讀寫在 `src/theme.ts`。
- **切換鈕**：header（`DemoNav.tsx`）「市民／清潔隊」右邊的圓形鈕，day 顯示月亮、night 顯示太陽，即時生效。
- **token 集中在 `frontend/src/styles/tokens.css`**：原版 token 在最上方的 `:root`；`:root[data-theme="day"]` 區塊放 day 的全部 `--px-*` 色票、圓角、字體，並把原版 token（`--teal`、`--signal`、`--chrome`、`--text`…）改掛到 `--px-*`；`:root[data-theme="night"]` 區塊把 `--px-*` 對映回原版 token。styles.css 與 skin-*.css 只放規則，不再定義色碼 token。
- **day 語意色**：

| 語意 | token | 值 |
| --- | --- | --- |
| 餓了（可以丟） | `--px-hungry`／文字 `--px-hungry-ink` | #A8E09A／#34802F |
| 吃飽了 | `--px-full`／文字 `--px-full-ink` | #F07A6A／#BF4637 |
| 失聯 | `--px-offline`／文字 `--px-offline-ink` | #A9A6C2／#6B6890 |
| 互動與選取 | `--px-purple`（`--px-select` 指向它） | #6F63D9 |

  night 沿用原版：餓了 teal、吃飽了橘、失聯灰，互動 teal、選取橘。night 下文字輸入框（input／textarea／select）的 focus 外框用 teal（token `--input-focus`），按鈕、連結、地圖選取等其他焦點仍為橘。
- **theme-color 同步**：`<meta name="theme-color">` 隨主題切換（載入時由 inline script 設定，切換時由 `setTheme` 更新）。day #ffffff、night #232826 這兩個值同時寫在 `frontend/index.html` 與 `src/theme.ts` 的 `THEME_COLORS`，改頁首底色（`--px-card`、`chrome`）時兩處一起改。
- **day 的色彩規則**：綠／紅／灰只代表桶況，紫只代表互動與選取（按鈕、連結、選中列、十字線、焦點環）。不要用綠、紅、灰做按鈕或選取，也不要用紫表示桶況。（「橘色＝選取」「teal＝可以去」只適用 night。）
- **新樣式撰寫規則**：
  1. 像素皮膚對原版元素的覆蓋（顏色、圓角、陰影、字體）寫 `:where(:root[data-theme="day"]) .xxx { … }`（`:where()` 不增加權重）。
  2. 新結構（main 沒有的元素）寫不帶前綴的規則，顏色只引用 `--px-*` token，兩個主題共用同一份。
  3. 新增色碼或 `--px-*` token 一律加在 tokens.css，day、night 各補一份值；規則檔不寫死色碼。
  4. night 專屬規則寫在 `skin-night.css`（`:root[data-theme="night"] …`）。

## 成功時刻動效

- **何時播**：只在「剛成功的那一次」播放——認領成功（地圖桶名牌彈出、像素愛心飄起，bottom sheet 本身不動）、小車預約或修改成功（詳情卡右上角小車開進來停住、人數彈一下並飄出 +1）。重新進入頁面、重新整理或切換回來不重播；小車平常進頁面是靜態停在原位。
- **限制**：總長小於 1 秒；像素圖只做 translate 與 opacity，不做縮放（像素圖只能整數倍放大）；裝飾節點加 `aria-hidden` 與 `pointer-events:none`；播完後版面要與沒播時一致，不能留下位移或多出的節點。
- **reduced-motion**：`prefers-reduced-motion: reduce` 時一律不播，只顯示最終靜態狀態。
- **不改既有像素元件**：動效以疊加的裝飾節點與 class 實現，不改 binBot、像素愛心、小車 icon 的圖形與尺寸。

## 3. 字體與字級

四套 Google Fonts，在 `styles.css` 第一行 `@import` 載入：

- **Chakra Petch**（`--font-display`）：數字與英文品牌字（滿度、計數、分鐘數、BinSoon、點數）。
- **IBM Plex Mono**（`--font-mono`）：全大寫英文小標（AVAILABLE · 示意、FILL LEVEL、STATUS、FROM 大安森林公園）。
- **Noto Sans TC**（`--font-sans`）：所有中文，也是 body 預設字。
- **Silkscreen**（`--font-pixel`）：像素點綴，極少量；目前未使用。

字級一律用 token：`--text-numeral-xl/lg/md/sm`、`--text-label`、`--text-label-lg`、`--text-title`、`--text-card-title`、`--text-heading`、`--text-status`、`--text-caption`。tokens.css 同時提供 `.numeral-xl`、`.label` 等工具 class，`.label` 已用在面板小標與側邊選單分組。頁面 h1：桌面 30px／手機 22px（Noto Sans TC 700）；地圖面板大標用 `--text-title`（手機縮成 24px）。

## 4. 間距與圓角

- 間距：`--space-1` 4、`--space-2` 8、`--space-3` 12、`--space-4` 16（手機左右邊界）、`--space-5` 18（卡片左右內距）、`--space-6` 28（桌面面板與地圖浮層邊距）。
- 圓角：`--radius-xs` 2（分頁切換內按鈕、圖示框）、`--radius-sm` 4（按鈕、輸入框、標籤、點數按鈕）、`--radius-md` 6（卡片、桶況卡）、`--radius-pill`（篩選膠囊）。圓形只用在等級徽章、失聯虛線圓框與投票四步圓點（選中圓框已改為底座）。舊樣式的圓角已全部換成這四個 token。

## 5. 元件

| 元件 | class／檔案 | 規則 |
| --- | --- | --- |
| 主按鈕 | `.button.primary` | teal 底、`text-on-light`、高 44、圓角 sm；卡片內主按鈕文字靠左、箭頭靠右 |
| 外框按鈕 | `.button.secondary` | 透明底、`line-control` 框、`text` 字（設計稿「回報狀況」） |
| 文字按鈕 | `.text-button` | `text` 白字＋2px `signal` 底線，至少 44×44 |
| 圖示按鈕 | `.icon-button` | 44×44、`line-control` 細框、圓角 sm、透明底；導航 ✕ 結束導航與投票分享鈕共用 |
| 卡片 | `.card` | chrome 底、1px `line` 框、圓角 md、無陰影 |
| 篩選膠囊 | `.filter-chips button` | pill、`line-input` 框；已選為 2px `signal` 框、不填底、白字 |
| 分頁切換 | `.tabs` | 外框 sm、內按鈕 xs；已選為 2px `signal` 內框、不填底、白字 |
| 頂欄分頁 | `.primary-tabs`、`.desktop-nav` | 未選 `text-muted`；目前頁 `aria-current="page"`，白字＋3px teal 底線 |
| 輸入框 | `input`、`select`、`textarea` | field 底、`line-input` 框、高 44；手機 16px 字 |
| 回報哪一桶／種類切換 | `WastePicker`（`components/WasteType.tsx`）、`.segmented` | 兩格單選（原生 radio），選中為 2px teal 框＋teal 字（配色 v4 例外，不改橘） |
| 種類標籤 | `WasteTag`、`.waste-icon` | 一般垃圾（垃圾桶圖示）／資源回收（♻），只用圖示和文字區分，不加顏色 |
| 桶況卡片 | `StationCard`（`components/StationCard.tsx`）、`.station-card` | 見第 6 節 |
| 最近的可用小夥伴 | `.nearest-card`（API 地圖頁） | 2px divider 標題線、1px hairline 列線；編號與分鐘數 teal、`numeral-sm`，不加深色底塊 |
| 地圖標記 | `mascotSvg()`、`markerIcon()`、`.pixel-marker` | 見第 7 節 |
| 圖例 | `MapLegend`、`.map-legend` | 地圖底部 chrome 列：餓了／吃飽了／失聯（虛線）／場所代表點 |
| 地區標籤 | `.map-district` | 地圖左上 chrome 小牌＋7px teal 方塊 |
| 頂欄＋側邊選單 | `AppNav`（`components/AppNav.tsx`）、`.topbar`、`.drawer` | 見第 8 節 |
| 狀態膠囊 | `.status-pill.state-*` | 青綠／橘色字與框；吃飽了前加像素小 z；失聯是虛線框。無狀態的 `.status-pill` 用於「新設」「場所」標題膠囊 |
| 清單列 | `.mx-list .location-row` | 剛看過的列 `active`＋`aria-current`，左側 3px `signal` 線；吃飽了百分比後加小 z；全部失聯時「可丟 0/2」用 `text-muted` |
| 警示 | `.storage-warning`、`.toast`、`.map-warning`、頁面 `[role="alert"]`、`.navigation-reroute` | `field` 底＋3px `text-muted` 左框，前加「⚠」；不用橘 |
| 底部抽屜 | `useBottomSheet`、`SheetHandle`（`components/useBottomSheet.tsx`）、`.mx-panel`、`.gnav-card` | 見第 8 節 |
| 桶詳情 | `BinPanel`（`api/BinPage.tsx`） | 標題靠左，新桶標題旁「新設」膠囊；不顯示行政區與「既有公布桶」、不放 88px 大角色；上留白 8px |
| 場所詳情 | `PlacePanel`（`api/PlacePanel.tsx`）、`.mx-place-card` | 與桶詳情同骨架：標題＋「場所」膠囊 → `place` 色帶「周邊的清潔箱 N 處」＋說明句 → 預設收合的「資料來源」；無動作按鈕、無 × |
| 投票面板 | `VotePanel`（`api/VotePanel.tsx`）、`.mx-vote-panel` | 見下方「投票面板」 |

**投票面板**（建議點，`BinProposal` → `VoteHeader`＋`VoteBallot`）：

- 標題列靠左：問句「你支持在這裡放垃圾桶嗎？」＋地點名，右上 `.icon-button` 分享（先 `navigator.share`，不支援開 LINE／複製連結小選單）。
- 半圓儀表 240px（窄於 380px 時 200px，兩側標籤改上下疊）：支持 `teal` 從左、不支持 `text-body` 從右、60% 白色（`text`）門檻線；兩側「支持 95%」「5% 不支持」，弧心「還差 N 人」（滿 60 人「已滿」）。
- 說明句「滿 60 人、支持 60% 以上，就會送環保局評估。」，不寫「示意」。計票與百分比在 `data/voteTally.ts`，照後端 `participation.py:66-67`；未達門檻不顯示成 60%。
- 未登入也顯示支持／不支持；按下去登入，回來自動投下並播動畫。投完留在面板（不跳 `vote-done`），下方出現「已投下支持，謝謝你！ 邀朋友一起投」、分隔線、「從投票到設桶」四步（Chakra Petch 號碼圓點）與「我的投票紀錄 →」。
- 字級只用 20／16／14／12；不用橘。動畫（儀表弧 600ms、+1、門檻線閃）只在未減少動態效果時播。

## 6. 桶況：前端三態、後端四態與雙桶

**前端只有三態**（`src/data/binState.ts`，唯一定義）：

| 前端 BinState | 文案 | 條件 | 視覺 |
| --- | --- | --- | --- |
| `hungry` | 餓了 | 0–79% | `status-hungry` 青綠 |
| `full` | 吃飽了 | 80% 以上 | `status-full` 橘（day：珊瑚紅），滿度條加斜紋 |
| `offline` | 失聯 | 沒有讀值、維修中或撤除 | `status-offline` 灰＋虛線外框 |

**後端 API 仍回四態 `fill_status`**（hungry <50、half 50–79、full ≥80、unknown＝未知／維修／撤除）。前端只在 API 轉接層對照，不改後端與 API 契約：`src/data/api.ts` 的 `apiBinState()`：`hungry`、`half` → hungry；`full` → full；`unknown` → offline。狀態列文字由 `components/api/Waste.tsx` 的 `statusText()` 產生（撤除→「已撤除」、維修→「維修中」、無讀值→「失聯」、其餘「餓了 · 62%」）。視覺對照（token、虛線、class）集中在 `src/components/binVisual.ts` 的 `stateVisual`，CSS 用 `.state-hungry/.state-full/.state-offline`。

**一個點兩個桶**（與 `backend/docs/WASTE_STREAMS.md` 一致）：

- 每個公布桶點位都有 `general`（一般垃圾）與 `recycling`（資源回收）兩槽；CSV 沒有分類證據，屬 `demo_assumption`（舊單槽資料對應 general，`legacy_assumed_general`）。場所代表點沒有桶槽。仍是 811 筆位置紀錄、681 個公布桶位置，兩槽是同一位置底下的示意子桶，不新增地圖點、不改快照。
- **點位整體狀態**（`stationState()`）：任一桶能丟 → 餓了；沒有能丟的桶但至少一桶吃飽了 → 吃飽了；兩桶都沒有讀值 → 失聯。
- **API 模式**：讀 `Location.compartments`／`BinView.compartments`（`apiCompartments()` 依 general、recycling 排序）。舊回應沒有 compartments 時安全降級成單槽（以選定種類的 `status` 當一般垃圾），卡片改用 SingleBinCard 樣式並註明「後端未提供分槽資料」。
- **示意模式**（`tests/legacy` 歷史展示）：`src/data/binDemo.ts` 產生兩槽；一般槽沿用原本的單一示意讀值，回收槽讀值另存 `readings["<位置 id>:recycling"]`，維修只限制對應槽。
- **StationCard**（預設）：色帶顯示「幾桶能丟」0/2、1/2、2/2（`numeral-lg`），色帶左側 `AVAILABLE · 示意` 與總結句（兩桶都還能丟／資源回收還能丟／兩桶都吃飽了／兩桶都失聯）；吃飽了時色帶下加斜紋警示條。下方一般垃圾、資源回收各一列：圖示、狀態字、`numeral-md` 滿度、6px 滿度條（餓了實心青綠、吃飽了橘色斜紋、失聯虛線空條）。手機版兩列左右並排；手機桶詳情藏狀態字，但吃飽了那一槽仍顯示「吃飽了」＋像素小 z（`.compartment-full-tag`）。
- **SingleBinCard**（備用）：`numeral-xl` 滿度＋`FILL LEVEL · 示意`。目前所有桶點都是兩槽，只有在 API 沒回 compartments 時才會出現。設計規範要求單桶點要提醒最近的另一種桶，未來若出現真正的單槽點要補上。
- **按鈕**：兩桶都能丟或一般能丟 →「導航過去」；只有回收能丟 →「導航過去丟回收」（`#nav/<id>?waste_type=recycling`，導航與替代桶查詢都帶 waste_type）；都不能丟 →「尋找可用桶並導航」。三種都是 teal 主按鈕。
- **回報與工單**：回報表單一定要選是哪一桶（預設一般垃圾），API body 送 `waste_type`；示意流程同一位置同一問題但不同種類是不同事件與工單。清潔隊清單與工單詳情用 `WasteTag` 標出種類。**認養仍以點位為單位**，涵蓋兩槽。
- **篩選**：「餓了的桶」（示意模式為「只看餓了的」）＝點位整體是餓了，也就是至少一桶還能丟；API 模式在前端依 compartments 篩選，「新設的桶」仍交後端。舊的「還能裝的桶」與「餓了」在三態下相同，已合併。

## 7. 地圖與標記

- **底圖**：`src/map/basemapStyle.ts` 的 `binsoonBasemapStyle()`，來源仍是 OpenFreeMap 的 openmaptiles 向量圖磚與字型；只畫街區、公園、水域、建築、道路、少量路名與地名，配色全取自 map 系列 token。保留 Leaflet 署名（OpenFreeMap · OpenMapTiles · © OpenStreetMap）與載入失敗提示（圖磚來源錯誤或 15 秒未讀到 TileJSON 時顯示 `.map-warning`）。
- **桶標記：垃圾桶機器人**（MapMarker，2026-10-21 起取代桶的電子雞）：`src/map/binBot.ts`，24×23 像素圖、3/4 視角露出右側面，放大 2 倍（框 52×52，手機同尺寸；像素圖只能整數倍放大），底部中心對準位置，自帶像素影子。外型與配色取自使用者提供的設計稿，螢幕放大成 14×7 讓表情更清楚；外框 `text-on-light`、眼白 `mascot-eye`、腮紅 `mascot-blush`。一個點只放一隻，不加 ♻ 徽章。
- **favicon**：`frontend/public/` 的 `favicon.svg`、`favicon-32.png`、`apple-touch-icon.png`，圖案是 binBot 的 hungry 狀態加 happy 臉再加白色描邊，由腳本從 `binBot.ts` 產生（腳本不在 repo）。改機器人外型或配色時，這三個檔需重新產生。
  - 整隻（蓋子＋箱身）依點位整體狀態換色並換表情：餓了＝青綠＋開心臉；吃飽了＝橘＋想睡臉與小 z；失聯＝灰＋傷心臉（含淚）、燈號熄燈，並保留 1.5px 虛線圓框。
  - 動態只在 hover／鍵盤焦點（循環）與選中（餓了播一輪、其他播兩輪後停回靜態）時播放：餓了＝跳一下後拿零食吃（只有吃東西時出現嘴巴）、吃飽了＝點頭打瞌睡、失聯＝發抖甩眼淚。`prefers-reduced-motion` 一律只顯示靜態表情。換幀規則在 `styles.css` 的 `.bin-bot`。
  - 撤除：現場已沒有桶，不畫角色，只畫同形狀的虛線外框，「撤」字放在框中間；外框用 `currentColor`（CSS 給 `text-on-light-muted`，外觀不變）。
  - **會疊就聚合**（2026-10-21，`src/map/botClusters.ts`）：不管縮放多少，畫面上會疊在一起的桶（1 倍時 40px 內、2 倍時 48px 內）合成一隻代表桶，右上角深色數字泡泡＝桶數；代表桶的顏色與表情取裡面最好的狀態（有能丟＝餓了，否則有滿的＝吃飽了，都沒有＝失聯）。點代表桶放大兩級。縮放 15 以下角色縮成 1 倍（26px），16 以上 2 倍；18 以上全部展開。選中的桶、撤除、地標、建議點不參與聚合。這是唯一允許的數字徽章。
- 場所代表點仍是電子雞：`place` 身體＋頭上星星，沒有腮紅（`mascotSvg()`）。
- **建議點（M3）**：`proposedBinSvg()`，垃圾桶機器人同形狀的虛線外框（`teal-on-mint`）、框內淡底（`mascot-eye` 70%）、中間「＋」，52×52、腳底對準位置；下方小牌「支持 95%」／「還沒人投」／關票後「評估中」「里長確認中」（`voteMarkerLabel()`）。清單列建議點圖示用同一個 SVG。
- **選中**（取代原本的 2.5px 圓環）：腳下像素風實心底座（`selectedBaseHtml()`：`signal` 填色＋`route-casing` 深色外框＋中間一圈 `mascot-eye` 白色同心環）＋橘色十字定位線（`signal-on-light` 虛線，交點對腳底）。底座寬 `--base-w`：1 倍 42px（約角色 1.75 倍）、其他級距 56／72px（約 1.5 倍），地標 42px。底座與十字線放在所有標記下層（Leaflet shadowPane，`.mx-selected-base`），鄰居角色會壓在底座上。
- 市民地圖（`.mx-map`）選中的桶與地標放大 1.3 倍（以腳底為基準），剛選中播一次放大（`.mx-pick` 220ms）、取消選取播縮回（`.mx-unpick`）；減少動態效果時只放大不播。新設的「新」小牌保留（mint 底），隨放大移到右上角。
- 示意起點「起」：`text-on-light` 底、mint 字的小方塊；示意路線為 `text-on-light` 虛線。
- **市民步行導航**（`api/NavigationPage.tsx`＋`LocationMap` 的 `navRoute`，2026-10-21 起只有步行）：路線＝橘色 `--route` 主線 7px＋`--route-casing` 深色外框 11px（外框比主線寬 4px），圓端點與圓轉角；畫在底圖之上、所有標記與血條之下。走過的路段外框與主線同步混入底圖色變淡。起點是 mint 圓點加深色環與「起點 · 大安森林公園」小牌（固定展示點，不取 GPS）；終點是目標桶機器人標記；模擬前進時有一顆青綠定位點。版面手機為滿版地圖＋底部抽屜（與地圖頁同一套 `useBottomSheet`，半開 50%；路線框法把抽屜停點高度算進下方留白），桌面為左側面板。抽屜標題列：未開始時放目的桶名，導航中放「下一步：…」，右側 `.icon-button` ✕＝結束導航（回到該桶詳情，Esc 同效）；「步行導航」標題只留給讀屏（`visually-hidden`）。開始導航抽屜自動收起，抵達回半開。資訊卡有預估分鐘（teal）、距離、桶名與種類（一般垃圾在前、資源回收在後）、青綠「開始導航」主按鈕與可展開的逐步轉彎指示清單（`aria-expanded`、`<h3>` 標題、目前一步 `aria-current="step"`）；開始後頂部 chrome 指示條顯示方向箭頭、距離與文字。轉彎資訊不只靠顏色：箭頭圖示加中文文字。

## 8. 手機優先規則與導覽

- **頂欄（手機）**：最左漢堡按鈕｜「地圖｜設桶投票」兩個分頁｜右上點數按鈕（＝會員中心，顯示可用點數與 PTS；未登入時是「登入」，隊員／管理員顯示角色）。不放 Logo，**沒有底部導覽列**。
- **頂欄（桌面）**：漢堡＋Logo 底塊（mint）＋找垃圾桶、會員中心、清潔隊工作台、管理員＋點數按鈕＋帳號／登出。會員子頁統一標示會員中心為目前區域。
- **左側側邊選單**（手機、桌面共用）：從左滑出、遮罩、Esc 與點遮罩可關閉、焦點鎖在側邊欄、關閉後焦點回到漢堡按鈕、點連結後自動關閉；`prefers-reduced-motion` 時不做滑動動畫。市民區只保留找垃圾桶、設桶投票、會員中心；回報、等級、獎品及通知收進會員中心，認養從地圖桶詳情的「待認養」進入。清潔隊／管理員功能、各角色登入、帳號與登出保留。
- **地圖頁（手機）**：滿版地圖＋底部抽屜（收起／半開／全開）。抽屜未選取時是「附近的桶」清單（半開 42%，最高 300px）；選桶、建議點或地標時在同一個抽屜原地顯示詳情（不滿版、不另開頁），回到半開：桶詳情 50%、投票面板 55%。
  - 選取時地圖平順飛到該點並置中在可見區（頂欄下緣到抽屜上緣之間）：同縮放且不到一個畫面只平移（0.5s），否則 `flyTo`（0.7s，縮放至少 16）；減少動態效果時直接跳。使用者自己拖、縮放地圖後不再自動拉回。
  - 回清單：點地圖空白處（排除拖曳、雙擊縮放）或按 Esc；回到清單時剛看過的列標 `aria-current`。詳情不放「← 返回清單」與 ×，只有一顆鍵盤聚焦才出現的「回到清單」（`.mx-close-detail`）。
  - 抽屜標題一律靠左（清單、桶、場所、投票、導航）。桶詳情的「導航過去／回報問題」固定在抽屜底部（sticky，半開、全開都看得到）。
  - 內容切換（清單⇄詳情、桶換桶）淡入並上移 8px（200ms），減少動態效果時不播。
- **抽屜手勢**（`useBottomSheet`，地圖頁與導航頁共用，仿 Google Maps）：把手與標題列可拖、點把手切換停點、上下鍵調整；內容區未全開時往上滑先移動整個抽屜，全開後同一手勢接著捲內容，全開且捲到頂再往下拖改拖抽屜。內容區 `touch-action: none`，捲動與慣性由 hook 接手；放開依位置與速度吸附停點。
- 觸控目標至少 44px；手機左右邊界 16px；輸入框 16px 字；不得有橫向捲動（e2e 會檢查 `scrollWidth <= innerWidth`）。

## 9. 程式對照

| 項目 | 位置 |
| --- | --- |
| 色票 token（原版段為設計系統產生，勿手改；末段為 day／night 主題 token） | `frontend/src/styles/tokens.css` |
| 全站樣式 | `frontend/src/styles.css`：開頭 `@import` 字體與 tokens、衍生 token、頂欄與側邊選單、按鈕／膠囊／輸入框／卡片、地圖首頁、Leaflet 控制項、電子雞標記、一般頁面、桶況卡片、手機版媒體查詢；之後是舊 A／B／D 展示頁樣式（已全數改用 token）；最後是 API 正式流程樣式 |
| 三態與雙桶定義 | `frontend/src/data/binState.ts` |
| API 四態 → 三態、compartments | `frontend/src/data/api.ts`（`apiBinState`、`apiCompartments`、`apiStationState`） |
| 示意雙桶資料 | `frontend/src/data/binDemo.ts`（`binDemo().compartments`、`readingKey`） |
| 桶況視覺對照 | `frontend/src/components/binVisual.ts` |
| 電子雞／桶標記 | `frontend/src/components/mascotSvg.ts`、`Mascot.tsx`、`frontend/src/map/marker.ts`（含選中底座 `selectedBaseHtml`）、`frontend/src/map/binBot.ts`（垃圾桶機器人、撤除與建議點外框） |
| 瀏覽模式標記（地標、建議點） | `frontend/src/map/browseMarkers.ts` |
| 地圖選取飛行、點空白處、選中動畫 | `frontend/src/map/LocationMap.tsx` |
| 底部抽屜手勢 | `frontend/src/components/useBottomSheet.tsx`（`MapPage`、`NavigationPage` 共用） |
| 桶詳情／場所詳情／投票面板 | `frontend/src/components/api/BinPage.tsx`（`BinPanel`）、`PlacePanel.tsx`、`BinProposal.tsx`＋`VotePanel.tsx` |
| 計票規則與支持率 | `frontend/src/data/voteTally.ts`（照 `backend/app/modules/participation.py`） |
| 桶況卡片 | `frontend/src/components/StationCard.tsx` |
| 種類圖示、回報選桶、種類標籤 | `frontend/src/components/WasteType.tsx` |
| 頂欄與側邊選單 | `frontend/src/components/AppNav.tsx`（正式入口 `App.tsx`、歷史展示 `tests/legacy/App.tsx` 共用） |
| 底圖樣式 | `frontend/src/map/basemapStyle.ts` |

## 10. 和設計稿仍有落差的待決事項

1. 地圖首頁：設計稿選桶後在地圖右上（桌面）或地圖下方（手機）浮出桶況卡；目前手機在地圖下方抽屜原地顯示（2026-10-23），桌面在左側面板原地顯示，尚未做地圖右上浮卡。
2. 頂欄分頁「設桶投票」（原「要桶投票」）：正式入口已串接提案／投票，分頁連到後端提案列表；選點及座標輸入都可用。
3. 桌面主選單：設計稿為找垃圾桶／這裡需要桶／認養電子雞／清潔隊榮譽榜；正式入口保留現有的找垃圾桶／我的回報／會員中心／清潔隊工作台／管理員（後三項設計稿未涵蓋但不可移除）。
4. 「最近的可用小夥伴」依所選一般垃圾／資源回收種類查後端 nearest-usable，不將兩槽滿度平均；面板註明目前查詢種類。
5. 會員中心、回報完成、認養、獎勵頁：設計稿的等級徽章、+1 點色塊、月報等版面只在歷史展示頁有完整對應；正式入口的會員中心與回報完成頁目前只換視覺（等級卡改薄荷色塊、加電子雞），資料欄位維持 API 現有內容。
6. 設計稿 Adopt 頁的「一鍵通報附近清潔隊」是橘色按鈕，違反「橘色不做按鈕」；實作一律用 teal／外框按鈕。
7. 設計稿 Stamps 頁仍有底部導覽列，與 README「手機沒有底部導覽列」衝突；依 README 拿掉，改用漢堡選單。
8. 失聯標記虛線框：預覽用 #4c5a53（非 token），實作改用 `text-on-light-muted`。
9. 頁尾的 simulated 說明、桶詳情的來源／座標詳情與歷史清單是資料揭露需求，設計稿沒有，保留但用小字。
10. SingleBinCard 的「提醒最近的另一種桶」：目前所有桶點都是兩槽，沒有實作；若未來後端出現單槽點需補上。
11. 回報表單仍是 API 版的下拉選單與座標欄位；設計稿的五格問題類型按鈕與頁內相機只在歷史展示頁。

## 與 API 流程整合（#10／#11）

StationCard 在正式桶詳情可選取各槽（原生 button、aria-pressed），維持本站整體可用數與三態視覺，導航、回報、歷史及清運感謝以目前種類查詢。回報 WastePicker 切換種類時保留各槽獨立照片草稿，重試不改原命令種類。一般槽不可用但回收可用時，另提供明確「導航過去丟回收」選項，不將一般垃圾需求默默改成回收。API 三態對照先依營運狀態、未知讀值及 is_usable 排除不可使用的餓了狀態，避免未設置／維修桶被描述成能丟。

清運道路入口已開放，手機與桌面的側邊選單可進入；後端有序站點與兩車種道路指引使用相同 token。桶詳情的歷史、來源及地圖保留分區，窄螢幕可用，分類假設／simulated 提示不移除。
