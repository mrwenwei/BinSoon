import { useMemo, useState, type ComponentProps } from "react";
import { CrewRoutePlanner } from "../CrewRoutePlanner";
import { query, request, time, type RouteStops } from "../../data/api";
import { wasteName, type WasteType } from "../../data/waste";
import { type LocationRecord } from "../../data/locations";
import { useSession } from "./SessionContext";
import { useApi } from "./useApi";
import { LoadState } from "./LoadState";
import { StaffLogin } from "./StaffPages";
import { WasteSelect } from "./Waste";

export function RoutePage(
  props: Pick<
    ComponentProps<typeof CrewRoutePlanner>,
    "vehicle" | "onVehicleChange"
  >,
) {
  const { session } = useSession();
  return session?.user.roles.includes("staff") ? (
    <StaffRoute key={session.access_token} {...props} />
  ) : (
    <StaffLogin next="staff/route" />
  );
}
function StaffRoute(
  props: Pick<
    ComponentProps<typeof CrewRoutePlanner>,
    "vehicle" | "onVehicleChange"
  >,
) {
  const { session } = useSession();
  const [waste, setWaste] = useState<WasteType | "">("");
  const path = query("/staff/route-stops", waste ? { waste_type: waste } : {});
  const result = useApi(
    path,
    (signal) =>
      request<RouteStops>(path, { signal, token: session?.access_token }),
    true,
  );
  const plan = useMemo(() => {
    if (!result.data) return null;
    const { origin, stops } = result.data;
    return {
      origin: [origin.latitude, origin.longitude] as [number, number],
      bins: stops.map(
        (stop) =>
          ({
            id: stop.bin_id,
            kind: "bin",
            label: stop.label,
            latitude: stop.latitude,
            longitude: stop.longitude,
            district: "",
            address: null,
            note: "",
            source_type: "route_stop",
            source_file: null,
            source_row: null,
            location_precision: null,
            reported_count: null,
            bin_status: null,
          }) satisfies LocationRecord,
      ),
      tasks: stops.flatMap((stop) =>
        stop.work_order_ids.map((id) => ({
          id,
          locationId: stop.bin_id,
          label: `工單 ${id.slice(0, 8)}`,
        })),
      ),
      stopNotes: Object.fromEntries(
        stops.map((stop) => [
          stop.bin_id,
          stop.waste_types.map(wasteName).join("、"),
        ]),
      ),
    };
  }, [result.data]);
  return (
    <main className="page api-route-page">
      <a className="back-link" href="#staff/tasks">
        ← 返回派工清單
      </a>
      <div className="api-route-refresh">
        <WasteSelect value={waste} all onChange={setWaste} />
        <div>
          <p className="tiny">
            責任區：{session?.user.districts.join("、")} · 站點更新：
            {time(result.data?.generated_at ?? null)}
          </p>
          <button
            className="button secondary"
            disabled={result.loading || !!result.error}
            onClick={result.reload}
          >
            更新待辦站點
          </button>
        </div>
      </div>
      <LoadState {...result} />
      {!plan && <h1>清運道路指引</h1>}
      {plan && (
        <CrewRoutePlanner
          {...props}
          {...plan}
          ready={!result.loading && !result.error}
          available={!result.error}
        />
      )}
    </main>
  );
}
