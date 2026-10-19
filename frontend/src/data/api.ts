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
  adopter: { display_name: string } | null;
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
  created_at: string;
  type: string;
};
export type WorkOrder = WasteMetadata & {
  id: string;
  version: number;
  bin_id: string;
  event_id: string;
  type: Problem;
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
type Options = {
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
  const headers = new Headers();
  if (options.token) headers.set("Authorization", `Bearer ${options.token}`);
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
    data: payload as T,
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
};
export function command(
  path: string,
  body: unknown,
  actorId: string,
  etag: string | null = null,
): Command {
  return {
    path,
    key: crypto.randomUUID(),
    serialized: JSON.stringify(body),
    etag,
    actorId,
  };
}
export function sendCommand<T>(operation: Command, session: Session) {
  if (operation.actorId !== session.user.id)
    throw new ApiError(403, "ACTOR_CHANGED", "請使用原操作帳號登入後重試。");
  return request<T>(operation.path, {
    method: "POST",
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
