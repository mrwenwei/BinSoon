import {
  ApiError,
  type Adoption,
  type ApiLocation,
  type BinStatus,
  type BinView,
  type Membership,
  type Notification,
  type Options,
  type PointEntry,
  type Proposal,
  type Redemption,
  type Report,
  type Result,
  type Reward,
  type Session,
} from "./api";
import {
  DEMO_TOKEN,
  DEMO_STORE_KEY,
  DEMO_UPDATED,
  isDemoToken,
} from "./demoMode";
import { demoBinLocations, demoLocation } from "./demoBins";
import { locations } from "./locations";
import { validatePhoto } from "./media";
import { isPhoneBrowser } from "./phone";

export const DEMO_SIGNED_IN = "binsoon-demo-signed-in";
const KEY = DEMO_STORE_KEY;
const CREATED = "2026-10-20T08:00:00Z";
const now = () => new Date().toISOString();
const month = (value = now()) =>
  new Date(value)
    .toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" })
    .slice(0, 7);
export function demoSession(): Session {
  return {
    access_token: DEMO_TOKEN,
    token_type: "bearer",
    expires_at: new Date(Date.now() + 3600000).toISOString(),
    user: {
      id: "local-demo-citizen",
      display_name: "展示市民小安",
      roles: ["citizen"],
      districts: [],
      auth_source: "demo",
    },
  };
}
export function rememberDemoLogin(enabled: boolean) {
  try {
    if (enabled) sessionStorage.setItem(DEMO_SIGNED_IN, "yes");
    else sessionStorage.removeItem(DEMO_SIGNED_IN);
  } catch {
    /* In-memory sign-in remains available. */
  }
}
export function restoreDemoLogin() {
  try {
    return sessionStorage.getItem(DEMO_SIGNED_IN) === "yes"
      ? demoSession()
      : null;
  } catch {
    return null;
  }
}
type Media = { id: string; purpose: string; url: string };
type Receipt = {
  path: string;
  method: string;
  body: string;
  result: Result<unknown>;
};
export const DEMO_STAFF_ID = "demo-crew-shun";
export const demoStaffNames: Record<string, string> = {
  [DEMO_STAFF_ID]: "清潔員阿順",
  "demo-crew-qing": "清潔員阿清",
  "demo-crew-an": "清潔員阿安",
  "demo-crew-lin": "清潔員阿林",
  "demo-crew-he": "清潔員阿和",
};
export type DemoCrewCompletion = {
  eventId: string;
  staffId: string;
  completedAt: string;
  likedAt?: string;
  photo: string;
};
type State = {
  version: 1;
  adoption_naming_version?: 1;
  flow_version?: 1;
  crew_completions?: Record<string, DemoCrewCompletion>;
  reports: Report[];
  entries: PointEntry[];
  proposals: Proposal[];
  adoptions: Adoption[];
  rewards: Reward[];
  redemptions: Redemption[];
  notifications: Notification[];
  media: Media[];
  receipts: Record<string, Receipt>;
};
function seed(): State {
  const bin = locations.find(
    (item) => item.kind === "bin" && item.district === "大安區",
  )!;
  const reports: Report[] = ["approved", "approved", "approved", "pending"].map(
    (status, i) => ({
      id: `demo-report-${i + 1}`,
      bin_id: bin.id,
      event_id: `demo-event-${i}`,
      work_order_id: null,
      type: i === 1 ? "dirty" : "full",
      waste_type: i % 2 ? "recycling" : "general",
      classification_source: "demo_assumption",
      description: "本機示意案件，非現場回報。",
      photo_ids: ["demo-seed-photo"],
      status: status as Report["status"],
      work_status: null,
      assignment_status: "unassigned",
      event_status: status === "approved" ? "closed" : "open",
      first_reporter: true,
      adopter: i === 1 || i === 3,
      quick: false,
      pending_points: status === "pending" ? 2 : 0,
      awarded_points: status === "approved" ? (i === 1 ? 2 : 1) : 0,
      rejection_reason: null,
      created_at: CREATED,
      accepted_at: null,
      reviewed_at: status === "approved" ? CREATED : null,
      settled_at: status === "approved" ? CREATED : null,
    }),
  );
  const proposals: Proposal[] = [0, 1].map((i) => ({
    id: `demo-proposal-${i + 1}`,
    bin_id: `demo-proposed-bin-${i + 1}`,
    version: 1,
    name: ["公園入口 Bin友提案", "商圈路口 Bin友提案"][i],
    reason: "展示需求，仍須現勘，並非真實設桶。",
    district: "大安區",
    latitude: bin.latitude + 0.004 + i * 0.002,
    longitude: bin.longitude,
    created_at: CREATED,
    mine: false,
    support: i ? 38 : 9,
    oppose: i ? 7 : 3,
    total_votes: i ? 45 : 12,
    support_ratio: i ? 38 / 45 : 0.75,
    my_vote: null,
    status: "collecting",
    outcome_reason: null,
    voting_closed_at: null,
    pending_name: null,
    approved_name: null,
    name_status: null,
    is_demo: true,
    rule_version: "local_demo_v1",
  }));
  return {
    version: 1,
    reports,
    proposals,
    entries: [
      {
        id: "demo-initial",
        amount: 124,
        balance_after: 124,
        report_id: null,
        redemption_id: null,
        created_at: CREATED,
        type: "展示初始點數",
      },
      ...reports.slice(0, 3).map((report, i) => ({
        id: `demo-award-${i}`,
        amount: report.awarded_points,
        balance_after: [125, 127, 128][i],
        report_id: report.id,
        redemption_id: null,
        created_at: CREATED,
        type: "展示回報獎勵",
      })),
      {
        id: "demo-redemption-entry",
        amount: -35,
        balance_after: 93,
        report_id: null,
        redemption_id: "demo-redemption-initial",
        created_at: CREATED,
        type: "展示獎品兌換",
      },
    ],
    adoptions: [
      {
        id: "demo-adoption-1",
        version: 1,
        bin_id: bin.id,
        role: "居民",
        display_name: "展示市民小安",
        intro: "",
        preferences: { full: true, dumping: true, dirty: false },
        status: "active",
        created_at: CREATED,
        updated_at: CREATED,
        reason: "預設的本機展示認養，非後端核准紀錄。",
      },
    ],
    rewards: [
      {
        id: "demo-reward-1",
        code: "demo-coupon",
        name: "Bin友超商展示券",
        category: "coupon",
        cost: 35,
        stock: 8,
        is_demo: true,
        available: true,
      },
      {
        id: "demo-reward-2",
        code: "demo-coffee",
        name: "Bin友咖啡展示券",
        category: "coupon",
        cost: 70,
        stock: 3,
        is_demo: true,
        available: true,
      },
      {
        id: "demo-reward-3",
        code: "demo-grand",
        name: "Bin友旅行展示獎",
        category: "grand",
        cost: 1000,
        stock: 1,
        is_demo: true,
        available: true,
      },
    ],
    redemptions: [
      {
        id: "demo-redemption-initial",
        reward_id: "demo-reward-1",
        cost: 35,
        created_at: CREATED,
        status: "demo_issued",
        voucher_code: "DEMO-LOCAL-ONLY",
        is_demo: true,
      },
    ],
    media: [],
    receipts: {},
    notifications: [
      {
        id: "demo-notice-1",
        type: "report_reviewed",
        title: "Bin友感謝你的照顧",
        message: "這是本機展示通知，不代表真實查證。",
        created_at: CREATED,
        read_at: null,
        waste_type: "general",
        target: { kind: "report", id: reports[0].id },
      },
    ],
  };
}
// Derive a local ballot for each loaded suggested Bin. Keep the original Bin ID,
// coordinates and provenance; persist the ballot only with an explicit demo action.
function withSuggestedProposals(value: State): State {
  for (const bin of demoBinLocations.values()) {
    if (
      bin.placement_status !== "proposed" ||
      value.proposals.some((item) => item.bin_id === bin.id)
    )
      continue;
    value.proposals.push({
      id: `demo-suggested-${bin.id}`,
      bin_id: bin.id,
      version: 1,
      name: bin.label,
      reason: "建議設置點，仍須現勘；投票不代表已核准設置。",
      district: bin.district,
      latitude: bin.latitude,
      longitude: bin.longitude,
      created_at: CREATED,
      mine: false,
      support: 0,
      oppose: 0,
      total_votes: 0,
      support_ratio: null,
      my_vote: null,
      status: "collecting",
      outcome_reason: null,
      voting_closed_at: null,
      pending_name: null,
      approved_name: null,
      name_status: null,
      is_demo: true,
      rule_version: "local_demo_v1",
    });
  }
  return value;
}
// Upgrade existing local demos without resetting reports, votes or ended adoptions.
function withPrivateAdoptions(value: State): State {
  if (value.adoption_naming_version === 1) return value;
  const bins = locations
    .filter((item) => item.kind === "bin" && item.district === "大安區")
    .slice(0, 3);
  const names = ["全家炸雞桶", "下班等公車桶", "早餐店轉角桶"];
  for (const [index, bin] of bins.entries()) {
    const id = `demo-adoption-${index + 1}`;
    const existing = value.adoptions.find((item) => item.id === id);
    if (existing) {
      existing.private_bin_name ||= names[index];
    } else if (
      value.adoptions.filter((item) =>
        ["pending", "active"].includes(item.status),
      ).length < 5
    ) {
      value.adoptions.push({
        id,
        version: 1,
        bin_id: bin.id,
        role: "居民",
        display_name: "展示市民小安",
        private_bin_name: names[index],
        intro: "",
        status: "active",
        preferences: { full: true, dumping: true, dirty: false },
        created_at: CREATED,
        updated_at: CREATED,
        reason: "本機展示認領，非真實認領。",
      });
    }
  }
  value.adoption_naming_version = 1;
  return value;
}
// Add only explicit demo fixtures; never reset existing reports, points, votes or vouchers.
function withFlowData(value: State): State {
  if (value.flow_version === 1) return value;
  value.crew_completions ||= {};
  for (const report of value.reports) {
    if (
      /^demo-report-[123]$/.test(report.id) &&
      report.status === "approved" &&
      report.event_status === "closed"
    ) {
      report.work_status = "completed";
      report.assignment_status = "assigned";
      report.work_order_id = `citizen-${report.event_id}`;
      value.crew_completions[report.event_id] ||= {
        eventId: report.event_id,
        staffId:
          report.id === "demo-report-3" ? "demo-crew-qing" : DEMO_STAFF_ID,
        completedAt: report.settled_at || CREATED,
        photo: "",
      };
    }
  }
  const coffee = value.rewards.find((r) => r.code === "demo-coffee");
  if (coffee) {
    coffee.cost = 3;
    coffee.name = "超商咖啡（試營運展示）";
  }
  value.flow_version = 1;
  return value;
}
let memory: State | undefined;
function state(): State {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if (
      saved?.version === 1 &&
      [
        saved.reports,
        saved.entries,
        saved.proposals,
        saved.media,
        saved.adoptions,
        saved.rewards,
        saved.redemptions,
        saved.notifications,
      ].every(Array.isArray) &&
      saved.receipts &&
      typeof saved.receipts === "object"
    )
      return withFlowData(withPrivateAdoptions(withSuggestedProposals(saved)));
  } catch {
    /* Demo storage never falls through to private backend data. */
  }
  return withFlowData(
    withPrivateAdoptions(withSuggestedProposals((memory ||= seed()))),
  );
}
function commit(value: State) {
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    throw new ApiError(
      507,
      "DEMO_STORAGE_FULL",
      "本機展示儲存空間不足或不可用，請使用較小照片；本次未儲存，也未送往後端。",
    );
  }
  memory = value;
  window.dispatchEvent(new Event(DEMO_UPDATED));
}
function reportingSuspended(value: State) {
  const rejected = value.reports
    .filter((r) => r.status === "rejected" && r.reviewed_at)
    .map((r) => Date.parse(r.reviewed_at!))
    .filter(Number.isFinite)
    .sort((a, b) => b - a);
  return rejected.length >= 3 && rejected[2] + 7 * 86400000 > Date.now();
}
export function demoMembership(value = state()): Membership {
  const cumulative = value.entries.reduce(
    (sum, item) => sum + Math.max(0, item.amount),
    0,
  );
  const tiers = [
    { name: "見習生", at: 0 },
    { name: "新手", at: 10 },
    { name: "獨當一面", at: 50 },
    { name: "高手", at: 150 },
    { name: "專家", at: 500 },
    { name: "教授", at: 1000 },
  ];
  const index = tiers.reduce(
    (last, tier, index) => (cumulative >= tier.at ? index : last),
    0,
  );
  const next = tiers[index + 1];
  return {
    cumulative_points: cumulative,
    available_points: value.entries.reduce((sum, item) => sum + item.amount, 0),
    pending_points: value.reports.reduce(
      (sum, item) => sum + item.pending_points,
      0,
    ),
    approved_report_count: value.reports.filter(
      (item) => item.status === "approved",
    ).length,
    rejected_report_count: value.reports.filter(
      (item) => item.status === "rejected",
    ).length,
    reporting_suspended: reportingSuspended(value),
    current_tier: { name: tiers[index].name },
    next_tier: next ? { name: next.name } : null,
    points_to_next_tier: next ? next.at - cumulative : null,
  };
}
function page<T>(items: T[], url: URL) {
  const limit = Math.max(
    1,
    Math.min(100, Number(url.searchParams.get("limit")) || 20),
  );
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
  return {
    items: items.slice(offset, offset + limit),
    page: { total: items.length, offset, limit },
  };
}
const result = (data: unknown, version?: number): Result<unknown> => ({
  data: structuredClone(data),
  etag: version ? `"v${version}"` : null,
  replayed: false,
});
function found<T>(item: T | undefined, description: string): T {
  if (!item)
    throw new ApiError(
      404,
      "DEMO_NOT_FOUND",
      `找不到這筆本機展示${description}。`,
    );
  return item;
}
function coordinate(latitude: unknown, longitude: unknown) {
  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  )
    throw new ApiError(422, "VALIDATION_ERROR", "請提供有效的數值經緯度。");
  return { latitude, longitude };
}
function distance(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((a.latitude - b.latitude) * rad) / 2) ** 2 +
    Math.cos(a.latitude * rad) *
      Math.cos(b.latitude * rad) *
      Math.sin(((a.longitude - b.longitude) * rad) / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}
const baseStatus: BinStatus = {
  fill_level_pct: null,
  capacity_liters: 120,
  estimated_used_liters: null,
  fill_status: "unknown",
  is_usable: false,
  operational_status: "normal",
  unavailable_reasons: ["unknown"],
  is_new: false,
  installed_at: null,
  removed_at: null,
  reading_source_type: "simulated",
  observed_at: null,
  received_at: null,
  last_emptied_at: null,
  waste_type: "general",
  classification_source: "demo_assumption",
};
function binLocation(id: string, value = state()): ApiLocation | undefined {
  const cached = demoBinLocations.get(id);
  if (cached) return cached;
  const official = locations.find(
    (item) => item.kind === "bin" && item.id === id,
  );
  if (official)
    return demoLocation(
      {
        ...official,
        bin_type: "existing",
        placement_status: "existing",
        bin_status: baseStatus,
        compartments: [],
        distance_m: null,
        walking_estimate_seconds: null,
      },
      "general",
    );
  const proposal = value.proposals.find((item) => item.bin_id === id);
  return proposal
    ? demoLocation(
        {
          id,
          label: proposal.approved_name || proposal.name,
          address: null,
          note: "本機展示提案，尚未現勘或設置。",
          kind: "bin",
          district: proposal.district,
          latitude: proposal.latitude,
          longitude: proposal.longitude,
          source_type: "local_demo_proposal",
          source_row: null,
          source_file: null,
          location_precision: null,
          reported_count: null,
          bin_type: "proposed",
          placement_status: "proposed",
          distance_m: null,
          walking_estimate_seconds: null,
          bin_status: baseStatus,
          compartments: [],
        },
        "general",
      )
    : undefined;
}
function availability(url: URL, value = state()) {
  const origin = coordinate(
    Number(url.searchParams.get("latitude")),
    Number(url.searchParams.get("longitude")),
  );
  const radius = 300;
  const bins = [...demoBinLocations.values()]
    .filter(
      (item) =>
        item.placement_status !== "proposed" &&
        item.bin_status?.operational_status !== "removed",
    )
    .map((item) => ({ ...item, distance_m: distance(origin, item) }))
    .sort((a, b) => a.distance_m - b.distance_m);
  return {
    has_existing_bin_within_radius: bins.some(
      (item) => item.distance_m <= radius,
    ),
    radius_m: radius,
    nearest_installed_bin: bins[0] || null,
    bins: bins.filter((item) => item.distance_m <= radius),
    proposals: value.proposals.filter(
      (item) => distance(origin, item) <= radius,
    ),
  };
}
function quota(value = state()) {
  const used = value.proposals.filter(
    (item) => item.mine && month(item.created_at) === month(),
  ).length;
  return {
    month: month(),
    timezone: "Asia/Taipei",
    limit: 3,
    used,
    remaining: Math.max(0, 3 - used),
  };
}
function placeholder() {
  const tokens = getComputedStyle(document.documentElement);
  const color = (name: string) => tokens.getPropertyValue(name).trim();
  return (
    "data:image/svg+xml," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="640" height="480" fill="${color("--chrome")}"/><text x="40" y="160" fill="${color("--teal")}" font-size="56">DEMO</text><text x="40" y="240" fill="${color("--text")}" font-size="28">本機展示照片 · 非現場證據</text></svg>`,
    )
  );
}
function publicGet(url: URL, value: State): Result<unknown> | null {
  const name = url.pathname;
  if (name === "/rewards")
    return result(
      page(
        value.rewards.filter(
          (item) =>
            !url.searchParams.get("category") ||
            url.searchParams.get("category") === "all" ||
            item.category === url.searchParams.get("category"),
        ),
        url,
      ),
    );
  if (name === "/proposals")
    return result(
      page(
        value.proposals.filter(
          (item) =>
            (!url.searchParams.get("district") ||
              item.district === url.searchParams.get("district")) &&
            (!url.searchParams.get("status") ||
              item.status === url.searchParams.get("status")),
        ),
        url,
      ),
    );
  const proposal = name.match(/^\/proposals\/([^/]+)$/);
  if (proposal) {
    const item = found(
      value.proposals.find((item) => item.id === proposal[1]),
      "提案",
    );
    return result(item, item.version);
  }
  const view = name.match(/^\/bins\/(demo-proposed-bin-[^/]+)\/view$/);
  if (view) {
    const item = found(binLocation(view[1], value), "提案點位");
    const waste =
      url.searchParams.get("waste_type") === "recycling"
        ? "recycling"
        : "general";
    const location = demoLocation(item, waste);
    return result({
      location,
      status: location.bin_status,
      compartments: location.compartments,
      adopter: null,
      latest_cleanup: null,
      my_adoption_id: null,
      can_apply_adoption: false,
      can_report: false,
      report_block_reason: "not_installed",
    });
  }
  if (name === "/map/availability") return result(availability(url, value));
  if (name === "/map/nearest-usable" && demoBinLocations.size) {
    const origin = coordinate(
      Number(url.searchParams.get("latitude")),
      Number(url.searchParams.get("longitude")),
    );
    const waste =
      url.searchParams.get("waste_type") === "recycling"
        ? "recycling"
        : "general";
    const items = [...demoBinLocations.values()]
      .map((item) => demoLocation(item, waste))
      .filter(
        (item) =>
          item.id !== url.searchParams.get("exclude_bin_id") &&
          item.bin_status?.is_usable,
      )
      .map((item) => ({ ...item, distance_m: distance(origin, item) }))
      .sort((a, b) => a.distance_m - b.distance_m)
      .slice(0, 3);
    return result({ items });
  }
  if (name === "/public/outcomes")
    return result({
      month: url.searchParams.get("month") || month(),
      timezone: "Asia/Taipei",
      district: url.searchParams.get("district") || "大安區",
      waste_type: url.searchParams.get("waste_type"),
      completed_count: 24,
      like_count: 56,
    });
  return null;
}
function privateGet(url: URL, value: State): Result<unknown> | null {
  const name = url.pathname;
  if (name === "/me") return result(demoSession().user);
  if (name === "/me/membership") return result(demoMembership(value));
  if (name === "/me/point-entries")
    return result(page([...value.entries].reverse(), url));
  if (name === "/me/reports")
    return result(
      page(
        value.reports.filter(
          (item) =>
            !url.searchParams.get("waste_type") ||
            item.waste_type === url.searchParams.get("waste_type"),
        ),
        url,
      ),
    );
  if (name === "/me/proposal-quota") return result(quota(value));
  if (name === "/me/proposals")
    return result(
      page(
        value.proposals.filter((item) => item.mine),
        url,
      ),
    );
  if (name === "/me/votes")
    return result(
      page(
        value.proposals.filter((item) => item.my_vote),
        url,
      ),
    );
  if (name === "/me/adoptions")
    return result(
      page(
        value.adoptions.filter(
          (item) =>
            !url.searchParams.get("status") ||
            item.status === url.searchParams.get("status"),
        ),
        url,
      ),
    );
  if (name === "/me/redemptions")
    return result(page([...value.redemptions].reverse(), url));
  if (name === "/me/notifications")
    return result(
      page(
        value.notifications.filter(
          (item) =>
            url.searchParams.get("unread_only") !== "true" || !item.read_at,
        ),
        url,
      ),
    );
  const report = name.match(/^\/reports\/([^/]+)$/);
  if (report)
    return result(
      found(
        value.reports.find((item) => item.id === report[1]),
        "案件",
      ),
    );
  const redemption = name.match(/^\/redemptions\/([^/]+)$/);
  if (redemption)
    return result(
      found(
        value.redemptions.find((item) => item.id === redemption[1]),
        "展示券",
      ),
    );
  const media = name.match(/^\/media\/([^/]+)\/access$/);
  if (media)
    return result({
      url:
        media[1] === "demo-seed-photo"
          ? placeholder()
          : found(
              value.media.find((item) => item.id === media[1]),
              "照片",
            ).url,
      expires_at: new Date(Date.now() + 300000).toISOString(),
    });
  const adoption = name.match(/^\/adoptions\/([^/]+)(?:\/(monthly-summary))?$/);
  if (adoption) {
    const item = found(
      value.adoptions.find((item) => item.id === adoption[1]),
      "認養",
    );
    if (!adoption[2]) return result(item, item.version);
    const selected = url.searchParams.get("month") || month();
    const reports = value.reports.filter(
      (report) =>
        report.bin_id === item.bin_id &&
        report.quick &&
        month(report.created_at) === selected,
    );
    return result({
      adoption_id: item.id,
      month: selected,
      timezone: "Asia/Taipei",
      reports_submitted: reports.length,
      reports_approved: reports.filter((report) => report.status === "approved")
        .length,
      points_awarded: reports.reduce(
        (sum, report) => sum + report.awarded_points,
        0,
      ),
      is_partial_month: month(item.created_at) === selected,
      source_type: "local_demo",
    });
  }
  return null;
}
function checkVersion(version: number, options: Options) {
  if (options.etag && options.etag !== `"v${version}"`)
    throw new ApiError(
      412,
      "VERSION_CONFLICT",
      "本機展示資料已更新，請重新確認後操作。",
    );
}
function text(value: unknown, max = 500) {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new ApiError(
      422,
      "VALIDATION_ERROR",
      `請提供 1 到 ${max} 字的內容。`,
    );
  return value.trim();
}
async function mutate(
  url: URL,
  options: Options,
  value: State,
): Promise<Result<unknown>> {
  const name = url.pathname;
  const body = options.serialized
    ? JSON.parse(options.serialized)
    : options.body || {};
  if (name === "/media" && body instanceof FormData) {
    const file = body.get("file");
    if (!(file instanceof File) || body.get("purpose") !== "report")
      throw new ApiError(422, "VALIDATION_ERROR", "展示市民只能上傳回報照片。");
    await validatePhoto(file);
    const url = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () =>
        reject(new ApiError(422, "INVALID_MEDIA", "照片無法讀取。"));
      reader.readAsDataURL(file);
    });
    const item = {
      id: `demo-media-${crypto.randomUUID()}`,
      purpose: "report",
      url,
    };
    value.media.push(item);
    return result({ id: item.id, purpose: item.purpose });
  }
  if (name === "/reports") {
    if (reportingSuspended(value))
      throw new ApiError(
        403,
        "REPORTING_SUSPENDED",
        "本機展示：近期不實回報達三次，暫停回報七天；其他會員功能仍可使用。",
      );
    const bin = found(binLocation(body.bin_id, value), "Bin友");
    const position = coordinate(
      body.position?.latitude,
      body.position?.longitude,
    );
    if (
      bin.placement_status === "proposed" ||
      bin.bin_status?.operational_status !== "normal"
    )
      throw new ApiError(409, "INVALID_TRANSITION", "此 Bin友目前無法回報。");
    if (distance(position, bin) > 50)
      throw new ApiError(
        422,
        "PROXIMITY_TOO_FAR",
        "本機展示位置距 Bin友超過 50 公尺，請使用此桶座標。這不是實測 GPS。",
      );
    if (
      !Array.isArray(body.photo_ids) ||
      body.photo_ids.length !== 1 ||
      !value.media.some(
        (item) => item.id === body.photo_ids[0] && item.purpose === "report",
      )
    )
      throw new ApiError(422, "INVALID_MEDIA", "請先提供本機展示照片。");
    if (
      !["full", "dirty", "dumping", "broken", "other"].includes(body.type) ||
      !["general", "recycling"].includes(body.waste_type)
    )
      throw new ApiError(422, "VALIDATION_ERROR", "請選擇問題與垃圾種類。");
    if (
      typeof body.description !== "string" ||
      body.description.length > 500 ||
      (body.type === "other" && !body.description.trim())
    )
      throw new ApiError(422, "VALIDATION_ERROR", "說明內容無效。");
    const same = value.reports.find(
      (item) =>
        item.bin_id === body.bin_id &&
        item.waste_type === body.waste_type &&
        item.type === body.type &&
        item.event_status === "open",
    );
    if (same) return result(same);
    const adopter = value.adoptions.some(
      (item) => item.bin_id === bin.id && item.status === "active",
    );
    if (body.quick && !adopter)
      throw new ApiError(403, "FORBIDDEN", "僅展示中的有效認養可快捷通報。");
    const item: Report = {
      id: `demo-report-${crypto.randomUUID()}`,
      bin_id: bin.id,
      event_id: `demo-event-${crypto.randomUUID()}`,
      work_order_id: null,
      type: body.type,
      waste_type: body.waste_type,
      classification_source: "demo_assumption",
      description: body.description,
      photo_ids: body.photo_ids,
      status: "pending",
      work_status: null,
      assignment_status: "unassigned",
      event_status: "open",
      first_reporter: true,
      adopter,
      quick: Boolean(body.quick),
      pending_points: adopter ? 2 : 1,
      awarded_points: 0,
      rejection_reason: null,
      created_at: now(),
      accepted_at: null,
      reviewed_at: null,
      settled_at: null,
    };
    value.reports.unshift(item);
    return result(item);
  }
  if (name === "/proposals") {
    if (!quota(value).remaining)
      throw new ApiError(
        409,
        "MONTHLY_QUOTA_EXCEEDED",
        "本機展示本月最多建立三個提案。",
      );
    const point = coordinate(body.latitude, body.longitude);
    const nearby = availability(
      new URL(
        `/map/availability?latitude=${point.latitude}&longitude=${point.longitude}`,
        "http://local",
      ),
      value,
    );
    if (
      nearby.proposals.some((item) => distance(point, item) <= 50) &&
      !body.confirmed_nearby
    )
      throw new ApiError(
        409,
        "NEARBY_PROPOSAL",
        "此處附近已有本機展示提案，請先查看與投票。",
      );
    const item: Proposal = {
      id: `demo-proposal-${crypto.randomUUID()}`,
      bin_id: `demo-proposed-bin-${crypto.randomUUID()}`,
      ...point,
      version: 1,
      name: text(body.name, 200),
      reason: text(body.reason),
      district: "大安區",
      created_at: now(),
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
      rule_version: "local_demo_v1",
    };
    value.proposals.unshift(item);
    return result({
      proposal: item,
      quota: quota(value),
      warnings: nearby.bins.map((item) => ({
        code: "NEAR_EXISTING_BIN",
        bin_id: item.id,
        distance_m: item.distance_m,
      })),
    });
  }
  const proposal = name.match(/^\/proposals\/([^/]+)\/(vote|name-requests)$/);
  if (proposal) {
    const item = found(
      value.proposals.find((item) => item.id === proposal[1]),
      "提案",
    );
    checkVersion(item.version, options);
    if (proposal[2] === "name-requests") {
      if (
        !item.mine ||
        item.status !== "installed" ||
        item.name_status === "pending"
      )
        throw new ApiError(
          409,
          "INVALID_TRANSITION",
          "請在認領桶後設定私人桶名。",
        );
      throw new ApiError(
        410,
        "PRIVATE_NAMING_ONLY",
        "請在認領桶後設定私人桶名，無需送審或公開。",
      );
    } else {
      if (item.status !== "collecting" || item.voting_closed_at)
        throw new ApiError(409, "VOTING_CLOSED", "此展示提案已關票。");
      if (![null, "support", "oppose"].includes(body.vote))
        throw new ApiError(422, "VALIDATION_ERROR", "投票選項無效。");
      if (item.my_vote === "support") item.support--;
      if (item.my_vote === "oppose") item.oppose--;
      item.my_vote = body.vote;
      if (item.my_vote === "support") item.support++;
      if (item.my_vote === "oppose") item.oppose++;
      item.total_votes = item.support + item.oppose;
      item.support_ratio = item.total_votes
        ? item.support / item.total_votes
        : null;
      if (item.total_votes >= 60) {
        item.voting_closed_at = now();
        item.status = item.support_ratio! >= 0.6 ? "evaluation" : "village";
      }
    }
    item.version++;
    return result(item, item.version);
  }
  if (name === "/redemptions") {
    const reward = found(
      value.rewards.find((item) => item.id === body.reward_id),
      "獎品",
    );
    const member = demoMembership(value);
    if (!reward.available)
      throw new ApiError(409, "REWARD_UNAVAILABLE", "此展示獎勵尚未開放兌換。");
    if (reward.stock <= 0)
      throw new ApiError(409, "OUT_OF_STOCK", "展示獎品已售罄。");
    if (member.available_points < reward.cost)
      throw new ApiError(409, "INSUFFICIENT_POINTS", "展示點數不足。");
    const item: Redemption = {
      id: `demo-redemption-${crypto.randomUUID()}`,
      reward_id: reward.id,
      cost: reward.cost,
      created_at: now(),
      status: "demo_issued",
      voucher_code: `DEMO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      is_demo: true,
    };
    value.redemptions.push(item);
    reward.stock--;
    value.entries.push({
      id: crypto.randomUUID(),
      type: "展示獎品兌換",
      amount: -reward.cost,
      balance_after: member.available_points - reward.cost,
      report_id: null,
      redemption_id: item.id,
      created_at: item.created_at,
    });
    return result({
      redemption: item,
      membership: demoMembership(value),
      reward,
    });
  }
  if (name === "/adoptions") {
    if (
      value.adoptions.filter((item) =>
        ["pending", "active"].includes(item.status),
      ).length >= 5
    )
      throw new ApiError(
        409,
        "ADOPTION_LIMIT",
        "每人至多認領 5 個桶；請先結束現有認領再選新桶。",
      );
    const privateName = text(body.private_bin_name, 50);
    const bin = found(binLocation(body.bin_id, value), "Bin友");
    if (
      bin.placement_status === "proposed" ||
      bin.bin_status?.operational_status !== "normal" ||
      value.adoptions.some(
        (item) =>
          item.bin_id === body.bin_id &&
          ["pending", "active"].includes(item.status),
      )
    )
      throw new ApiError(
        409,
        "INVALID_TRANSITION",
        "此展示 Bin友目前無法申請認養。",
      );
    if (!["居民", "店家", "學校", "社區團體"].includes(body.role))
      throw new ApiError(422, "VALIDATION_ERROR", "認養身份無效。");
    const item: Adoption = {
      id: `demo-adoption-${crypto.randomUUID()}`,
      version: 1,
      bin_id: bin.id,
      role: body.role,
      display_name: "展示市民小安",
      private_bin_name: privateName,
      intro: body.role === "店家" ? String(body.intro || "").slice(0, 500) : "",
      preferences: {
        full: Boolean(body.preferences?.full),
        dirty: Boolean(body.preferences?.dirty),
        dumping: Boolean(body.preferences?.dumping),
      },
      status: "active",
      created_at: now(),
      updated_at: now(),
      reason: "本機展示認領，非真實認領。",
    };
    value.adoptions.unshift(item);
    return result(item, item.version);
  }
  const adoption = name.match(
    /^\/adoptions\/([^/]+)\/(preferences|private-name|withdraw|end)$/,
  );
  if (adoption) {
    const item = found(
      value.adoptions.find((item) => item.id === adoption[1]),
      "認養",
    );
    checkVersion(item.version, options);
    if (
      adoption[2] === "withdraw"
        ? item.status !== "pending"
        : item.status !== "active"
    )
      throw new ApiError(409, "INVALID_TRANSITION", "展示認養狀態已更新。");
    if (adoption[2] === "private-name")
      item.private_bin_name = text(body.private_bin_name, 50);
    else if (adoption[2] === "preferences")
      item.preferences = {
        full: Boolean(body.full),
        dirty: Boolean(body.dirty),
        dumping: Boolean(body.dumping),
      };
    else {
      item.status = adoption[2] === "withdraw" ? "withdrawn" : "ended";
      item.reason = body.reason
        ? text(body.reason)
        : "本機展示結束或撤回認養。";
      item.preferences = { full: false, dirty: false, dumping: false };
    }
    item.version++;
    item.updated_at = now();
    return result(item, item.version);
  }
  const notice = name.match(/^\/me\/notifications\/([^/]+)\/read$/);
  if (notice) {
    const item = found(
      value.notifications.find((item) => item.id === notice[1]),
      "通知",
    );
    item.read_at ||= now();
    return result(item);
  }
  throw new ApiError(
    403,
    "LOCAL_DEMO_ONLY",
    "此操作不屬於市民本機展示，不會送往後端。",
  );
}
export function decorateCitizenView(
  path: string,
  payload: unknown,
  token?: string,
): unknown {
  if (!isDemoToken(token)) return payload;
  const value = state();
  const active = value.adoptions.filter((item) => item.status === "active");
  const personalLocation = (location: ApiLocation) => {
    const mine = active.find((item) => item.bin_id === location.id);
    return mine?.private_bin_name
      ? { ...location, label: mine.private_bin_name }
      : location;
  };
  if (/^\/map\/(locations|nearest-usable)(?:\?|$)/.test(path)) {
    const page = payload as { items: ApiLocation[] };
    return { ...page, items: page.items.map(personalLocation) };
  }
  if (!/^\/bins\/[^/]+\/view(?:\?|$)/.test(path)) return payload;
  const view = payload as BinView;
  const adoption = value.adoptions.find(
    (item) =>
      item.bin_id === view.location.id &&
      ["pending", "active"].includes(item.status),
  );
  return {
    ...view,
    location: personalLocation(view.location),
    my_adoption_id: adoption?.id || null,
    can_report: view.can_report && !reportingSuspended(value),
    report_block_reason: reportingSuspended(value)
      ? "suspended"
      : view.report_block_reason,
    can_apply_adoption:
      view.can_report &&
      !adoption &&
      value.adoptions.filter((item) =>
        ["pending", "active"].includes(item.status),
      ).length < 5,
    // Other citizens may claim this same Bin; a private alias is never a public adopter name.
    adopter: null,
  };
}
let writes: Promise<unknown> = Promise.resolve();
export async function demoRequest(
  path: string,
  options: Options,
): Promise<Result<unknown> | null> {
  const url = new URL(path, "http://local");
  const method = options.method || "GET";
  if (method === "GET")
    return (
      (isDemoToken(options.token) ? privateGet(url, state()) : null) ||
      publicGet(url, state())
    );
  if (!isDemoToken(options.token)) return null;
  if (url.pathname === "/auth/session" && method === "DELETE")
    return result(undefined);
  const operation = async () => {
    options.signal?.throwIfAborted();
    const value = structuredClone(state());
    const signature =
      options.serialized ??
      JSON.stringify(
        options.body instanceof FormData ? {} : options.body || {},
      );
    if (options.key && value.receipts[options.key]) {
      const receipt = value.receipts[options.key];
      if (
        receipt.path !== path ||
        receipt.method !== method ||
        receipt.body !== signature
      )
        throw new ApiError(
          409,
          "IDEMPOTENCY_CONFLICT",
          "展示操作識別碼已用於其他資料。",
        );
      return { ...receipt.result, replayed: true };
    }
    const response = await mutate(url, options, value);
    options.signal?.throwIfAborted();
    if (options.key)
      value.receipts[options.key] = {
        path,
        method,
        body: signature,
        result: response,
      };
    commit(value);
    return response;
  };
  return localWrite(operation);
}
async function localWrite<T>(operation: () => T | Promise<T>): Promise<T> {
  if (navigator.locks) return navigator.locks.request(KEY, operation);
  const next = writes.then(operation, operation);
  writes = next.catch(() => {});
  return next;
}

export function demoCitizenSnapshot() {
  return structuredClone(state());
}
export function demoBinById(id: string) {
  return binLocation(id, state());
}
export function demoReportCompletion(report: Report) {
  return state().crew_completions?.[report.event_id];
}
export async function likeDemoReport(reportId: string) {
  if (!restoreDemoLogin()) throw new Error("請先以展示市民登入。");
  return localWrite(() => {
    const value = structuredClone(state());
    const report = found(
      value.reports.find((r) => r.id === reportId),
      "回報",
    );
    const completion = value.crew_completions?.[report.event_id];
    if (
      report.status !== "approved" ||
      report.work_status !== "completed" ||
      !completion
    )
      throw new Error("清潔員完成且查證屬實後才能按讚。");
    if (completion.likedAt) return;
    completion.likedAt = now();
    commit(value);
  });
}
export async function updateDemoCrewCase(
  eventId: string,
  change: {
    arrived?: boolean;
    truth?: "yes" | "no";
    finish?: boolean;
    photo?: string;
    composition?: string;
  },
) {
  if (
    sessionStorage.getItem("binsoon-crew-demo-session") !== "yes" ||
    !isPhoneBrowser()
  )
    throw new Error("請以模擬清潔員登入，並使用手機現場處理。");
  return localWrite(() => {
    const value = structuredClone(state());
    const reports = value.reports.filter((r) => r.event_id === eventId);
    if (!reports.length) throw new Error("找不到本機展示案件。");
    if (
      reports.some((r) => binLocation(r.bin_id, value)?.district !== "大安區")
    )
      throw new Error("此案件不在大安區模擬清潔員的展示責任區。");
    if (value.crew_completions?.[eventId]) return;
    const at = now();
    if (change.arrived)
      for (const report of reports) {
        report.work_status = "arrived";
        report.assignment_status = "assigned";
        report.work_order_id = `citizen-${eventId}`;
        report.accepted_at ||= at;
        if (report.status === "pending") report.status = "processing";
      }
    if (change.truth) {
      if (reports.some((r) => r.work_status !== "arrived"))
        throw new Error("請先確認到場。");
      for (const report of reports) {
        if (report.settled_at) continue;
        report.status = change.truth === "yes" ? "approved" : "rejected";
        report.reviewed_at = at;
        report.settled_at = at;
        const points =
          change.truth === "yes" && report.first_reporter
            ? report.adopter
              ? 2
              : 1
            : 0;
        report.pending_points = 0;
        report.awarded_points = points;
        report.rejection_reason =
          change.truth === "no" ? "模擬現場查證：與回報不符" : null;
        if (points)
          value.entries.push({
            id: `demo-settlement-${report.id}`,
            type: "展示查證回報獎勵",
            amount: points,
            balance_after: demoMembership(value).available_points + points,
            report_id: report.id,
            redemption_id: null,
            created_at: at,
          });
        value.notifications.unshift({
          id: `demo-reviewed-${report.id}`,
          type: "report_reviewed",
          title: "清潔員已完成查證（模擬）",
          message: points
            ? `查證屬實，已入帳 ${points} 點。`
            : "查證結果已更新，請查看回報紀錄。",
          created_at: at,
          read_at: null,
          waste_type: report.waste_type || "general",
          target: { kind: "report", id: report.id },
        });
      }
    }
    if (change.finish) {
      if (
        reports.some((r) => r.work_status !== "arrived" || !r.settled_at) ||
        !["street", "household", "mixed"].includes(change.composition || "") ||
        !change.photo?.startsWith("data:image/svg+xml,")
      )
        throw new Error("完成前需到場、查證、垃圾組成及模擬完成照。");
      for (const report of reports) {
        report.work_status = "completed";
        report.event_status = "closed";
      }
      value.crew_completions ||= {};
      value.crew_completions[eventId] = {
        eventId,
        staffId: DEMO_STAFF_ID,
        completedAt: at,
        photo: change.photo,
      };
    }
    commit(value);
  });
}
