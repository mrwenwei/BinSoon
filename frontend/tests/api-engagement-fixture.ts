import { binId } from "./api-fixtures";
export const reward = {
  id: "61000000-0000-4000-8000-000000000001",
  code: "seven",
  name: "伺服器展示券",
  category: "coupon",
  cost: 30,
  stock: 2,
  is_demo: true,
  available: true,
};
export const redemption = {
  id: "62000000-0000-4000-8000-000000000001",
  reward_id: reward.id,
  cost: 30,
  created_at: "2026-10-20T01:00:00Z",
  status: "demo_issued",
  voucher_code: "DEMO-FIXTURE-ONLY",
  is_demo: true,
};
export const membership = {
  cumulative_points: 80,
  available_points: 80,
  pending_points: 2,
  approved_report_count: 4,
  rejected_report_count: 3,
  reporting_suspended: true,
  current_tier: { name: "好鄰居" },
  next_tier: null,
  points_to_next_tier: null,
};

export const proposalId = "71000000-0000-4000-8000-000000000001";
export const proposal = {
  id: proposalId,
  bin_id: binId,
  version: 1,
  name: "巷口需要桶",
  reason: "通勤路線沒有可用位置",
  latitude: 25.033,
  longitude: 121.5358,
  district: "大安區",
  created_at: "2026-10-20T01:00:00Z",
  mine: true,
  support: 1,
  oppose: 0,
  total_votes: 1,
  support_ratio: 1,
  my_vote: "support",
  status: "collecting",
  outcome_reason: null,
  voting_closed_at: null,
  pending_name: null,
  approved_name: null,
  name_status: null,
  is_demo: true,
  rule_version: "fixture",
};
export const quota = {
  month: "2026-10",
  timezone: "Asia/Taipei",
  limit: 3,
  used: 0,
  remaining: 3,
};
