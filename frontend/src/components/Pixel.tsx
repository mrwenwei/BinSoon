import { coinSvg, pixelHeartSvg } from "./pixelArt";

// 認領流程 v3 的共用小元件：像素愛心、代幣、點數徽章、名牌（愛心＋名字）。

export function PixelHeart({ scale = 2 }: { scale?: 2 | 3 }) {
  return (
    <span
      className="px-art"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: pixelHeartSvg(scale) }}
    />
  );
}

export function Coin() {
  return (
    <span
      className="px-art"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: coinSvg() }}
    />
  );
}

// 點數元件全站只有一顆：深色像素徽章裡「數字＋代幣」。認領列與取名步驟用中號，
// 內文、toast、確認框用小號；第一次出現的地方（label）下方加小字「點數」。讀屏唸「N 點」。
export function Points({
  value,
  small = false,
  label = false,
}: {
  value: number | string;
  small?: boolean;
  label?: boolean;
}) {
  const chip = (
    <span
      className={`points-chip${small ? " small" : ""}`}
      role="img"
      aria-label={`${value} 點`}
    >
      <span className={small ? "numeral-sm" : "numeral-md"}>{value}</span>
      <Coin />
    </span>
  );
  return label ? (
    <span className="points-chip-wrap">
      {chip}
      <span className="points-chip-label" aria-hidden="true">
        點數
      </span>
    </span>
  ) : (
    chip
  );
}

// 名牌：像素愛心 ×2＋名字，--mascot-eye 底、2px 階梯角像素框。
// size：m＝膠囊、toast、清單 14px；l＝卡片標題 16px；xl＝桶詳情與確認框標題 20px。
export function NameTag({
  name,
  size = "m",
}: {
  name: string;
  size?: "m" | "l" | "xl";
}) {
  return (
    <span className={`name-tag ${size}`}>
      <PixelHeart />
      <span className="name-tag-text">{name}</span>
    </span>
  );
}
