# Pixel Skin 規則（本機實驗，branch try/pixel-skin）

目標：整站「只換皮」。功能、DOM 結構、class 名稱、文字、資料邏輯、事件、
既有圖標（binBot、marker、像素愛心、mascot 等）的圖形／尺寸／動畫與 main 完全相同。
只換：顏色、字體、圓角、陰影、地圖底圖。

## 1. 語意色（唯一規則：綠紅灰只代表桶況，紫只代表互動）

| 語意 | 填色／主色 | 文字・細框（白底可讀） |
|---|---|---|
| 餓了（可以丟） | `#A8E09A` | `--px-hungry-ink` `#34802F` |
| 吃飽了 | `#F07A6A` | `--px-full-ink` `#BF4637` |
| 失聯 | `#A9A6C2` | 較深灰紫，白底對比 ≥ 4.5:1 |
| 互動：CTA、連結、選取、你在哪、焦點環、路線、勾選 | `#6F63D9`（hover/active `#5A4FC4`），上面放白字 | 同左 |

- 「餓了」的數字、百分比、標籤一律用綠（ink），**不可**因為原本讀 `--teal` 而變紫。
  原本用 `--teal` 的地方要逐一判斷是「餓了」還是「互動」，再對應。
- 吃飽了的斜紋滿度條：兩色都用珊瑚系（`#F07A6A` 與 `#BF4637`），**不用黑／深炭灰**。
- 圖示（icon）不可用淺紫／淡灰到看不見：裝飾性 icon 至少用 `--px-ink-muted`
  級別（對白底 ≥ 3:1），互動 icon 用紫。

## 2. 中性色與表面

- 頁面背景：米色 `#F4E1CB` 系；卡片／面板：白或米白；導覽列：淺色（不再深炭灰）。
- 文字：深墨紫灰（標題）、中灰紫（次要），白底對比 ≥ 4.5:1。
- 陰影：硬邊、無模糊，例如 `0 2px 0` / `0 3px 0` 帶淡墨色；不用大面積模糊陰影。

## 3. 圓角

- 卡片、面板、抽屜、清單列、對話框：20–24px
- 膠囊、按鈕、搜尋框、chips：999px
- 小元件（icon 框、輸入框內小塊、badge）：約 12px
- 只改 `border-radius`，不改尺寸。

## 4. 字體

- 中文：Noto Sans TC（只載入 400／500／700／900，禁止用 600／800）。
- 英文與數字：Nunito（與中文 fallback 並列）。

## 5. 實作規則

- 所有色碼集中在 `--px-*` 變數（定義在 styles.css 的 `:root` 像素皮膚區段；完整清單見第 6 節），規則一律引用變數，不寫死色碼。
- CSS 只允許純視覺屬性：color、background*、border-color、box-shadow、font-family、
  font-weight（限已載入字重）、border-radius、opacity、filter、outline-color、fill、stroke、
  accent-color。禁止 padding、margin、gap、width、height、min/max、font-size、line-height、
  position/top/left、display、flex/grid、border-width、transform。
- TS/TSX 只允許把寫死的色碼改成 `var(--x, 原色)`，fallback 必須等於 main 原色。
- 不改 tests/。不 push、不動 remote／main。dev server 會 proxy 到線上後端：
  截圖時不得觸發任何寫入（投票、認養、回報、提案送出、登入註冊），用 Playwright route 攔截 /api/v1 回假資料。

## 6. Token 表（第 1 階段完成後的最終版；之後以此為準）

全部定義在 `frontend/src/styles.css` 的「像素皮膚」`:root` 區塊（整站生效，沒有 `.px-map` 限定）。
各頁專屬樣式只寫在 `frontend/src/styles/skin-citizen.css`／`skin-civic.css`／`skin-crew.css`（`main.tsx` 在 `styles.css` 之後依序載入，因此同權重時它們贏）。寫規則時只引用下表變數，不寫死色碼。

### 6.1 `--px-*` 全部 token

| 名稱 | 值 | 用途 |
|---|---|---|
| `--px-ground` | `#f4e1cb` | 頁面背景（米色）、地圖地面 |
| `--px-brick-line` | `#ecd3b6` | 底圖磚紋線 |
| `--px-brick-light` | `#f8ebdc` | 底圖磚紋亮面 |
| `--px-block` | `#efd7bd` | 底圖街區 |
| `--px-building` | `#edd4b8` | 底圖建物 |
| `--px-building-edge` | `#d6b690` | 底圖建物描邊 |
| `--px-building-shadow` | `#e0c29f` | 底圖建物陰影 |
| `--px-grass` | `#bfe2a2` | 底圖草地 |
| `--px-grass-dot` | `#9dcf7d` | 底圖草點 |
| `--px-grass-light` | `#d8f0c3` | 底圖草地亮面 |
| `--px-wood` | `#addb8e` | 底圖樹林 |
| `--px-water` | `#acd6ee` | 底圖水域 |
| `--px-water-light` | `#e6f4fb` | 底圖水波亮面 |
| `--px-road` | `#d7d0e5` | 底圖道路 |
| `--px-road-edge` | `#bcb2d3` | 底圖道路外框 |
| `--px-road-dash` | `#ffffff` | 底圖道路虛線 |
| `--px-path` | `#e6cfb2` | 底圖步道 |
| `--px-rail` | `#9a90b0` | 底圖鐵路 |
| `--px-label-bg` | `rgba(255, 255, 255, 0.84)` | 底圖地名底 |
| `--px-label-halo` | `#ffffff` | 底圖地名描邊 |
| `--px-ink` | `#2f2a3d` | 標題／主要文字（深墨紫灰）；也是深色小標籤底 |
| `--px-ink-soft` | `#6f6784` | 次要文字 |
| `--px-ink-muted` | `var(--px-ink-soft)` | 裝飾性 icon 最淺可用色（= ink-soft，白底 ≥ 3:1） |
| `--px-ink-body` | `#4a4459` | 卡片內文 |
| `--px-card` | `#ffffff` | 卡片／面板／導覽列底（白） |
| `--px-card-alt` | `#fffaf4` | 輸入框、hover 列（米白） |
| `--px-line` | `#efe2d2` | 一般分隔線、卡片外框 |
| `--px-line-control` | `#d9c9b6` | 外框按鈕、標籤外框 |
| `--px-line-input` | `#e6d6c3` | 輸入框外框 |
| `--px-shadow` | `#e3c7a6` | 米色底上卡片的硬邊陰影（0 3px 0） |
| `--px-shadow-ink` | `rgba(47, 42, 61, 0.28)` | 標記的硬邊陰影 |
| `--px-dot-off` | `#ece3d8` | 未填滿的條底、停用小點 |
| `--px-card-glass` | `rgba(255, 255, 255, 0.8)` | 半透明白（地圖控制項底） |
| `--px-divider` | `rgba(47, 42, 61, 0.1)` | 區塊分隔線 |
| `--px-hairline` | `rgba(47, 42, 61, 0.07)` | 清單細線 |
| `--px-purple` | `#6f63d9` | 互動主色：CTA、連結、選取、你在哪、焦點環、路線、勾選 |
| `--px-purple-hover` | `#5a4fc4` | 主要按鈕 hover／active |
| `--px-purple-deep` | `#5247b8` | 淺底上的紫字、陰影邊、導覽選中字 |
| `--px-purple-soft` | `#ece9fb` | 淺紫底（選中底、--mint、--tint-teal） |
| `--px-on-purple` | `#ffffff` | 紫底上的白字 |
| `--px-select` | `var(--px-purple)` | 選取／你在哪（= --px-purple；要與互動分色時改這個） |
| `--px-van` | `#b8aef2` | 小車停靠點 icon 車身（淺紫；定義在 skin-van.css） |
| `--px-van-light` | `#dcd6fa` | 小車 icon 亮面 |
| `--px-van-shade` | `#9387e3` | 小車 icon 陰影面 |
| `--px-hungry` | `#a8e09a` | 餓了填色（桶身、條、色帶） |
| `--px-hungry-edge` | `#5faf55` | 草地上的綠桶描邊 |
| `--px-hungry-ink` | `#34802f` | 餓了的文字、數字、百分比、細框 |
| `--px-full` | `#f07a6a` | 吃飽了填色（桶身、條、斜紋亮色） |
| `--px-full-ink` | `#bf4637` | 吃飽了的文字、斜紋深色（白底可讀）；警示／錯誤文字也用 |
| `--px-offline` | `#a9a6c2` | 失聯填色 |
| `--px-offline-ink` | `#6b6890` | 失聯的文字與虛線框（白底 ≥ 4.5:1） |
| `--px-radius-card` | `22px` | 卡片、面板、抽屜、對話框（--radius-md） |
| `--px-radius-row` | `20px` | 清單列 |
| `--px-radius-small` | `12px` | icon 框、輸入框、badge（--radius-sm） |
| `--px-radius-pill` | `999px` | 按鈕、chips、搜尋框、狀態膠囊（--radius-pill） |
| `--px-radius-xs` | `8px` | 最小元件（--radius-xs） |
| `--px-bot-<hungry\|full\|offline>-<T,W,S,F,R,U,B,D>` | 共 24 個 | Bin友各格顏色（B 是主色）；透過 `--bot-<state>-<格>` 餵給 binBot.ts。值見 styles.css |

### 6.2 舊 token 在新皮膚下的對應

| 舊 token | 新值 | 說明 |
|---|---|---|
| `--teal` | `--px-purple` | 只代表「互動」（CTA、連結、選取、勾選、進度）。**餓了不可用它**，改用 `--px-hungry-ink`（字）／`--px-hungry`（填色） |
| `--teal-on-mint` | `--px-purple-deep` | 淺紫底上的紫字 |
| `--tint-teal` | `--px-purple-soft` | 淺紫底 |
| `--green` | `--teal`（= 紫） | 舊別名 |
| `--signal` | `--px-full` | **只代表吃飽了／警示**（珊瑚）。選取請用 `--px-select`；淺底上的珊瑚文字用 `--px-full-ink` |
| `--signal-on-light` | `--px-full-ink` | |
| `--tint-signal` | `color-mix(--signal 14%, --chrome)` | 淡珊瑚底（警示卡） |
| `--focus-ring`、`--route` | `--px-select` | 焦點環、導航路線＝紫 |
| `--status-hungry` | `--px-hungry` | 填色用；文字請用 `--px-hungry-ink` |
| `--status-full` | `--px-full` | |
| `--status-offline` | `--px-offline` | 填色用；文字／虛線框請用 `--px-offline-ink` |
| `--chrome`、`--panel` | `--px-card` | 導覽列、卡片、面板（白） |
| `--field` | `--px-card-alt` | 輸入框底 |
| `--mint` | `--px-purple-soft` | 淺紫底。**不可當前景色／icon 色**（淺到看不見），icon 用 `--px-ink-muted` 或紫 |
| `--map` | `--px-ground` | 米色 |
| `--text`、`--text-on-light` | `--px-ink` | 標題、主要文字 |
| `--text-muted` | `--px-ink-soft` | 次要文字 |
| `--text-body`、`--text-on-light-muted` | `--px-ink-body` | 內文 |
| `--line`、`--line-control`、`--line-input`、`--divider`、`--hairline` | `--px-line`、`--px-line-control`、`--px-line-input`、`--px-divider`、`--px-hairline` | 線條 |
| `--marker-shadow` | `--px-shadow-ink` | |
| `--radius-xs`／`-sm`／`-md`／`-pill` | 8px／12px／22px／999px | token 層級，所有 `var(--radius-*)` 自動生效；按鈕、狀態膠囊等另有膠囊規則 |
| `--font-sans`／`--font-display`／`--font-mono` | `--px-font-round` | Nunito → Noto Sans TC。`--font-pixel`（Silkscreen）保留 |

### 6.3 已經全域處理的語意規則（第 2 階段不用再做）

- 餓了的文字／細框／百分比走綠（`.status-pill.state-hungry`、`.row-state.state-hungry`、`.compartment.state-hungry .compartment-pct`、`.compartment-status`、`.mx-usable.state-hungry`），`.fill-bar > span` 預設綠；吃飽了斜紋條與 `.hazard-stripe` 是珊瑚兩色；失聯文字／虛線框用 `--px-offline-ink`。
- 選取類（`.tabs` 選中、`.mx-list .location-row.active`、`.marker-base`、十字線、`.nearby-proposals`）＝紫。`.button.primary`、`.filter-chips`、搜尋框、導覽選中項＝紫。
- 導覽列（`.topbar`、`.m-tabs`、`.staff-nav`、`.drawer-head`、`.drawer-section`、`.demo-identity`）＝淺底深字、選中紫。
- 淺色 icon 修正：`.claim-situations .icon`、`.row-state.place` 用 `--px-ink-muted`。若發現別處也用 `--mint`／`--place`／`--mascot-eye` 當前景色而看不見，請在自己的 skin 檔覆蓋成 `--px-ink-muted` 或 `--px-purple`。
- 紫底元素上的文字原本用 `--text-on-light`（現在是深墨色），已全域改成白（`--px-on-purple`）的清單見 styles.css「互動」段；新增紫底元素記得自己設白字。
- 所有 LocationMap 預設使用像素底圖（`basemap` 預設 `"pixel"`）。
