import { useDemoData, isDemoToken } from "./demoMode";
import { decorateCitizenView, demoRequest } from "./demoCitizen";
import { demoBinPayload, demoCityLoaded } from "./demoBins";
import { type WasteMetadata, type WasteType } from "./waste";
export type Role = "citizen" | "staff" | "admin";
export type User = {
  id: string;
  display_name: string;
  roles: Role[];
  districts: string[];
  auth_source: "demo";
};
export type Session = {
  access_token: string;
  expires_at: string;
  token_type: "bearer";
  user: User;
};
import { stationState, type BinState } from "./binState";
export type { WasteType };
export type Position = { latitude: number; longitude: number };
export type BinStatus = WasteMetadata & {
  fill_level_pct: number | null;
  capacity_liters: number | null;
  estimated_used_liters: number | null;
  fill_status: "hungry" | "half" | "full" | "unknown";
  is_usable: boolean;
  operational_status: "normal" | "repair" | "removed";
  unavailable_reasons: string[];
  is_new: boolean;
  installed_at: string | null;
  removed_at: string | null;
  reading_source_type: "simulated" | "iot_sensor" | null;
  observed_at: string | null;
  received_at: string | null;
  last_emptied_at: string | null;
  // 後端雙槽：舊回應沒有這兩欄時視為一般垃圾（legacy_assumed_general）。
  waste_type?: WasteType;
  classification_source?: string;
};
export type ApiLocation = Position & {
  id: string;
  kind: "bin" | "place";
  district: string;
  label: string;
  address: string | null;
  note: string;
  source_type: string;
  source_row: number | null;
  source_file: string | null;
  location_precision: "point_as_published" | "representative_point_only" | null;
  reported_count: number | null;
  bin_type: "existing" | "proposed" | null;
  placement_status: "existing" | "proposed" | "installed" | null;
  distance_m: number | null;
  walking_estimate_seconds: number | null;
  bin_status: BinStatus | null;
  compartments: BinStatus[];
};
export type Cleanup = WasteMetadata & {
  id: string;
  bin_id: string;
  work_order_id: string;
  completed_at: string;
  like_count: number;
  liked_by_me: boolean;
  can_like: boolean;
};
export type TaskReading = Omit<WasteMetadata, "waste_type"> & {
  waste_type: WasteType | null;
  id: string;
  bin_id: string;
  work_order_id: string;
  fill_level_pct: number;
  observed_at: string;
  received_at: string;
  source_type: "simulated" | "iot_sensor";
  event_type: "collection";
};
export type BinView = {
  location: ApiLocation;
  status: BinStatus;
  compartments: BinStatus[];
  adopter: { display_name: string; role: AdoptionRole; intro: string } | null;
  latest_cleanup: Cleanup | null;
  my_adoption_id: string | null;
  can_apply_adoption: boolean;
  can_report: boolean;
  report_block_reason: string | null;
};
export type Reading = {
  waste_type: WasteType | null;
  classification_source: string;
  id: string;
  recorded_at: string;
  fill_level_pct: number;
  event_type: string;
  source_type: string;
  generation: number | null;
};
export type PageData<T> = {
  items: T[];
  page: { limit: number; offset: number; total: number };
};
export type RouteStops = {
  origin: Position & { source: "demo_fixed" };
  stops: (Position & {
    bin_id: string;
    label: string;
    work_order_ids: string[];
    waste_types: WasteType[];
    priority: string;
  })[];
  generated_at: string;
};
export type Problem = "full" | "dirty" | "dumping" | "broken" | "other";
export type WorkStatus =
  | "pending"
  | "processing"
  | "arrived"
  | "waiting_sensor"
  | "repair"
  | "completed"
  | "dismissed";
export type Report = WasteMetadata & {
  id: string;
  bin_id: string;
  event_id: string;
  work_order_id: string | null;
  type: Problem;
  waste_type?: WasteType;
  description: string;
  photo_ids: string[];
  status: "pending" | "processing" | "approved" | "rejected";
  work_status: WorkStatus | null;
  assignment_status: "assigned" | "unassigned";
  event_status: "open" | "closed";
  first_reporter: boolean;
  adopter: boolean;
  quick: boolean;
  pending_points: number;
  awarded_points: number;
  rejection_reason: string | null;
  created_at: string;
  accepted_at: string | null;
  reviewed_at: string | null;
  settled_at: string | null;
};
export type Membership = {
  cumulative_points: number;
  available_points: number;
  pending_points: number;
  approved_report_count: number;
  rejected_report_count: number;
  reporting_suspended: boolean;
  current_tier: { name: string };
  next_tier: { name: string } | null;
  points_to_next_tier: number | null;
};
export type PointEntry = {
  id: string;
  amount: number;
  balance_after: number;
  report_id: string | null;
  redemption_id: string | null;
  created_at: string;
  type: string;
};
export type Reward = {
  id: string;
  code: string;
  name: string;
  category: "coupon" | "grand";
  cost: number;
  stock: number;
  is_demo: boolean;
  available: boolean;
};
export type Redemption = {
  id: string;
  reward_id: string;
  cost: number;
  created_at: string;
  status: "demo_issued";
  voucher_code: string;
  is_demo: true;
};
export type RedeemResult = {
  redemption: Redemption;
  membership: Membership;
  reward: Reward;
};
export type Proposal = Position & {
  id: string;
  version: number;
  bin_id: string;
  name: string;
  reason: string;
  district: string;
  created_at: string;
  mine: boolean;
  support: number;
  oppose: number;
  total_votes: number;
  support_ratio: number | null;
  my_vote: "support" | "oppose" | null;
  status:
    | "collecting"
    | "village"
    | "evaluation"
    | "survey"
    | "installed"
    | "declined";
  outcome_reason: string | null;
  voting_closed_at: string | null;
  pending_name: string | null;
  approved_name: string | null;
  name_status: "pending" | "approved" | "returned" | null;
  is_demo: boolean;
  rule_version: string;
};
export type ProposalQuota = {
  month: string;
  timezone: "Asia/Taipei";
  limit: number;
  used: number;
  remaining: number;
};
export type AdoptionRole = "居民" | "店家" | "學校" | "社區團體";
export type Preferences = { full: boolean; dumping: boolean; dirty: boolean };
export type AdoptionMonth = {
  adoption_id: string;
  month: string;
  timezone: "Asia/Taipei";
  reports_submitted: number;
  reports_approved: number;
  points_awarded: number;
  is_partial_month: boolean;
  source_type: string;
};
export type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  created_at: string;
  read_at: string | null;
  waste_type: WasteType | null;
  target: {
    kind: "report" | "work_order" | "proposal" | "adoption";
    id: string;
  };
};
export type Lifecycle = {
  bin_id: string;
  version: number;
  operational_status: string;
  placement_status: string;
  installed_at: string | null;
  removed_at: string | null;
  reason: string | null;
};
export type Adoption = {
  id: string;
  version: number;
  bin_id: string;
  role: AdoptionRole;
  display_name: string;
  intro: string;
  preferences: Preferences;
  status: "pending" | "active" | "rejected" | "withdrawn" | "ended";
  created_at: string;
  updated_at: string;
  reason: string;
};
export type ProposalCreated = {
  proposal: Proposal;
  quota: ProposalQuota;
  warnings: { code: "NEAR_EXISTING_BIN"; distance_m: number; bin_id: string }[];
};
export type Availability = {
  has_existing_bin_within_radius: boolean;
  radius_m: number;
  nearest_installed_bin: ApiLocation | null;
  bins: ApiLocation[];
  proposals: Proposal[];
};
export type PublicOutcomes = {
  month: string;
  timezone: "Asia/Taipei";
  district: string;
  waste_type: WasteType | null;
  completed_count: number;
  like_count: number;
};
export type Rank = {
  rank: number;
  staff_id: string;
  display_name: string;
  completed_count: number;
  average_processing_seconds: number | null;
  like_count: number;
};
export type StaffMonth = PublicOutcomes & {
  average_processing_seconds: number | null;
  bonus_display_only: true;
  ranking: Rank[];
};
export type WorkOrder = WasteMetadata & {
  id: string;
  version: number;
  bin_id: string;
  event_id: string;
  type: Problem;
  waste_type?: WasteType;
  status: WorkStatus;
  district: string;
  source: string;
  priority: "immediate" | "high" | "normal" | "inspection";
  assigned_staff_id: string | null;
  created_at: string;
  accepted_at: string | null;
  arrived_at: string | null;
  target_at: string | null;
  is_overdue: boolean;
  reason: string | null;
  blocked_by_removed_bin: boolean;
  photo_at: string | null;
  submitted_at: string | null;
  completed_at: string | null;
  clear_reading_id: string | null;
  completion_id: string | null;
};
export type WorkDetail = {
  work_order: WorkOrder;
  location: ApiLocation;
  reports: Report[];
  evidence: { id: string; media_id: string; purpose: string }[];
  latest_reading: TaskReading | null;
  completion_requirements: {
    arrived: boolean;
    reports_reviewed: boolean;
    completion_photo: boolean;
    work_submitted: boolean;
    fresh_clear_reading: boolean;
    missing: string[];
  };
};
export type Result<T> = { data: T; etag: string | null; replayed: boolean };

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields: { field: string; message: string }[] = [],
    public requestId?: string,
    public retryAt?: number,
  ) {
    super(message);
  }
}
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError)
    return `${error.message}${error.fields.length ? `：${error.fields.map((f) => `${f.field} ${f.message}`).join("；")}` : ""}${error.requestId ? `（請求 ${error.requestId}）` : ""}`;
  return "連線未完成，請檢查網路後重試；原操作已保留。";
}
export const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  "https://binsoon-api-887203439341.asia-east1.run.app/api/v1"
).replace(/\/$/, "");
export type Options = {
  token?: string;
  method?: string;
  body?: unknown;
  key?: string;
  etag?: string | null;
  signal?: AbortSignal;
  serialized?: string;
};
export async function request<T>(
  path: string,
  options: Options = {},
): Promise<Result<T>> {
  options.signal?.throwIfAborted();
  if (useDemoData(options.token)) {
    if (path.startsWith("/map/nearest-usable?") && !demoCityLoaded()) {
      const waste =
        new URL(path, "http://local").searchParams.get("waste_type") ||
        "general";
      await allPages<ApiLocation>(
        query("/map/locations", {
          district: "all",
          kind: "bin",
          filter: "all",
          waste_type: waste,
          include_proposed: true,
        }),
        { signal: options.signal, token: options.token },
      );
    }
    const local = await demoRequest(path, options);
    options.signal?.throwIfAborted();
    if (local)
      return {
        ...local,
        data: decorateCitizenView(path, local.data, options.token) as T,
      };
  }
  if (
    isDemoToken(options.token) &&
    ((options.method || "GET") !== "GET" ||
      /^\/(me|auth|reports|media|staff|admin|adoptions)(\/|\?|$)/.test(path))
  )
    throw new ApiError(
      403,
      "LOCAL_DEMO_ONLY",
      "此本機展示操作尚未開放，不會送往後端。",
    );
  const headers = new Headers();
  if (options.token && !isDemoToken(options.token))
    headers.set("Authorization", `Bearer ${options.token}`);
  if (options.key) headers.set("Idempotency-Key", options.key);
  if (options.etag) headers.set("If-Match", options.etag);
  const form = options.body instanceof FormData;
  if (options.serialized !== undefined || (options.body !== undefined && !form))
    headers.set("Content-Type", "application/json");
  const signal = options.signal
    ? AbortSignal.any([options.signal, AbortSignal.timeout(20000)])
    : AbortSignal.timeout(20000);
  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method || "GET",
    headers,
    signal,
    cache: "no-store",
    body:
      options.serialized ??
      (form
        ? (options.body as FormData)
        : options.body === undefined
          ? undefined
          : JSON.stringify(options.body)),
  });
  const raw = response.status === 204 ? "" : await response.text();
  let payload;
  try {
    payload = raw ? JSON.parse(raw) : undefined;
  } catch {
    /* A gateway can return HTML. Preserve status for safe retries. */
  }
  if (!response.ok) {
    const detail = payload?.detail;
    const retry = response.headers.get("Retry-After");
    const retryAt = retry
      ? /^\d+$/.test(retry)
        ? Date.now() + Number(retry) * 1000
        : Date.parse(retry)
      : undefined;
    throw new ApiError(
      response.status,
      detail?.code || "HTTP_ERROR",
      typeof detail === "string"
        ? detail
        : detail?.message || `服務請求失敗（${response.status}）`,
      Array.isArray(detail?.fields) ? detail.fields : [],
      detail?.request_id || response.headers.get("X-Request-ID") || undefined,
      retryAt,
    );
  }
  if (response.status !== 204 && payload === undefined)
    throw new Error("服務回應格式錯誤");
  return {
    data: (useDemoData(options.token)
      ? decorateCitizenView(
          path,
          demoBinPayload(path, payload, options.token),
          options.token,
        )
      : payload) as T,
    etag: response.headers.get("ETag"),
    replayed: response.headers.get("Idempotency-Replayed") === "true",
  };
}
export function query(
  path: string,
  values: Record<string, string | number | boolean>,
) {
  return `${path}?${new URLSearchParams(Object.entries(values).map(([k, v]) => [k, String(v)]))}`;
}
export async function allPages<T>(
  path: string,
  options: Options,
): Promise<T[]> {
  const items: T[] = [];
  let offset = 0;
  while (true) {
    const { data } = await request<PageData<T>>(
      `${path}${path.includes("?") ? "&" : "?"}limit=100&offset=${offset}`,
      options,
    );
    items.push(...data.items);
    offset += data.items.length;
    if (offset >= data.page.total) return items;
    if (!data.items.length) throw new Error("分頁未完整載入，請重試");
  }
}
export type Command = {
  path: string;
  key: string;
  serialized: string;
  etag: string | null;
  actorId: string;
  method?: "POST" | "PATCH";
};
export function command(
  path: string,
  body: unknown,
  actorId: string,
  etag: string | null = null,
  method?: "POST" | "PATCH",
): Command {
  return {
    path,
    key: crypto.randomUUID(),
    serialized: JSON.stringify(body),
    etag,
    actorId,
    ...(method ? { method } : {}),
  };
}
export function sendCommand<T>(operation: Command, session: Session) {
  if (operation.actorId !== session.user.id)
    throw new ApiError(403, "ACTOR_CHANGED", "請使用原操作帳號登入後重試。");
  return request<T>(operation.path, {
    method: operation.method || "POST",
    token: session.access_token,
    key: operation.key,
    serialized: operation.serialized,
    etag: operation.etag,
  });
}
export const problemLabels: Record<Problem, string> = {
  full: "滿了",
  dirty: "很髒",
  dumping: "桶旁有堆放",
  broken: "損壞",
  other: "其他",
};
export const workLabels: Record<WorkStatus, string> = {
  pending: "待接單",
  processing: "處理中",
  arrived: "已到場",
  waiting_sensor: "待感測確認",
  repair: "待修繕",
  completed: "已完成",
  dismissed: "無需處理",
};
export const reportLabels = {
  pending: "待查證",
  processing: "查證中",
  approved: "查證屬實",
  rejected: "查證不實",
};
export function time(value: string | null) {
  return value
    ? new Date(value).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })
    : "無資料";
}

// ── API 轉接層：後端四態 fill_status → 前端三態 BinState ──────────────
// 後端：hungry <50、half 50–79、full ≥80、unknown＝未知、維修或撤除。
// 前端：hungry、half → 餓了；full → 吃飽了；unknown → 失聯。不改後端契約。
export function apiBinState(status: BinStatus | null | undefined): BinState {
  if (
    !status ||
    status.fill_level_pct == null ||
    status.operational_status !== "normal"
  )
    return "offline";
  if (status.fill_status === "hungry" || status.fill_status === "half")
    return status.is_usable ? "hungry" : "offline";
  if (status.fill_status === "full") return "full";
  return "offline";
}
export type ApiCompartment = BinStatus & { waste_type: WasteType };
// 回傳一般垃圾、資源回收兩槽；後端沒給 compartments 時安全降級成只用
// 選定種類的 status（預設一般垃圾），卡片會改用單桶樣式。
export function apiCompartments(
  status: BinStatus | null | undefined,
  compartments?: BinStatus[],
): ApiCompartment[] {
  if (compartments?.length)
    return compartments
      .map((c) => ({ ...c, waste_type: c.waste_type || "general" }))
      .sort(
        (a, b) =>
          (a.waste_type === "general" ? -1 : 1) -
          (b.waste_type === "general" ? -1 : 1),
      );
  return status
    ? [{ ...status, waste_type: status.waste_type || "general" }]
    : [];
}
export function apiStationState(
  status: BinStatus | null | undefined,
  compartments?: BinStatus[],
): BinState {
  const list = apiCompartments(status, compartments);
  return list.length
    ? stationState(list.map((c) => ({ state: apiBinState(c) })))
    : "offline";
}
