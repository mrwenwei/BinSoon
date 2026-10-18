export const rewards = [
  {
    id: "seven",
    name: "7-11 50 元兌換券",
    brand: "7-ELEVEN",
    category: "coupon",
    cost: 30,
    stock: 380,
    symbol: "7",
    color: "orange",
    note: "給順手的你，一份日常小確幸。",
  },
  {
    id: "family",
    name: "全家 50 元兌換券",
    brand: "FamilyMart",
    category: "coupon",
    cost: 50,
    stock: 412,
    symbol: "F",
    color: "blue",
    note: "把城市的小善意，換成生活的小補給。",
  },
  {
    id: "flight",
    name: "日本來回機票",
    brand: "NEXT STOP, JAPAN",
    category: "grand",
    cost: 1000,
    stock: 3,
    symbol: "✈",
    color: "pink",
    note: "累積每一次付出，朝下一趟旅程前進。",
  },
  {
    id: "phone",
    name: "iPhone Duo",
    brand: "A BIG THANK YOU",
    category: "grand",
    cost: 3000,
    stock: 1,
    symbol: "▯",
    color: "purple",
    note: "獻給一直照顧城市的你。",
  },
] as const;
export type Reward = (typeof rewards)[number];
export type RewardId = Reward["id"];
export interface Redemption {
  id: string;
  rewardId: RewardId;
  cost: number;
  createdAt: string;
}
export function findReward(id: string) {
  return rewards.find((reward) => reward.id === id);
}
export function couponCode(redemption: Redemption) {
  return `DEMO-${redemption.rewardId.toUpperCase()}-${redemption.id.slice(0, 8).toUpperCase()}`;
}
