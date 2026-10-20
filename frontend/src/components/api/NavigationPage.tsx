import { wasteHref, type WasteControls } from "../../data/waste";
import { WasteSelect } from "./Waste";
import { useMemo } from "react";
import { query, request, type ApiLocation, type BinView } from "../../data/api";
import { LocationMap } from "../../map/LocationMap";
import { useQrCode } from "../useQrCode";
import { LoadState } from "./LoadState";
import { useApi } from "./useApi";
import { ORIGIN, ignoreSelect } from "./mapShared";
export function Navigation({
  view,
  wasteType,
  onWasteChange,
}: { view: BinView } & WasteControls) {
  const available = view.status.is_usable;
  const nextPath = query("/map/nearest-usable", {
    waste_type: wasteType,
    district: "all",
    ...ORIGIN,
    limit: 3,
    ...(wasteType === "recycling" ? { waste_type: "recycling" } : {}),
  });
  const alternatives = useApi(
    available ? null : nextPath,
    (signal) => request<{ items: ApiLocation[] }>(nextPath, { signal }),
    true,
  );
  const destination = available
    ? view.location
    : alternatives.data?.items.find(
        (p) => p.id !== view.location.id && p.bin_status?.is_usable,
      );
  const mapItems = useMemo(
    () =>
      destination
        ? [
            {
              ...destination,
              bin_status: available ? view.status : destination.bin_status,
            },
          ]
        : [],
    [destination, available, view.status],
  );
  const path = useMemo<[number, number][]>(
    () =>
      destination
        ? [
            [ORIGIN.latitude, ORIGIN.longitude],
            [ORIGIN.latitude, destination.longitude],
            [destination.latitude, destination.longitude],
          ]
        : [],
    [destination],
  );
  const url = `${window.location.origin}${window.location.pathname}${wasteHref(`nav/${destination?.id || view.location.id}`, wasteType)}`;
  const qr = useQrCode(url, 180);
  return (
    <main className="page navigation-page">
      <a
        className="back-link"
        href={wasteHref(`bin/${view.location.id}`, wasteType)}
      >
        返回桶詳情
      </a>
      <h1>步行導航</h1>
      <WasteSelect
        value={wasteType}
        onChange={(value) => {
          if (value) onWasteChange(value);
        }}
      />
      <p>大安森林公園固定示意起點 · 非即時 GPS，非實際道路指引。</p>
      {wasteType === "recycling" && (
        <p className="tiny">本次要丟：資源回收。</p>
      )}
      {!available && (
        <p role="status">原目的桶目前不可用，依後端結果尋找替代桶。</p>
      )}
      <LoadState {...alternatives} />
      {destination ? (
        <>
          <h2 className="navigation-destination">{destination.label}</h2>
          <p>路線與時間只作示意，請依現場道路通行。</p>
          <div className="api-detail-map">
            <LocationMap
              locations={mapItems}
              selected={null}
              onSelect={ignoreSelect}
              demoRoute={path}
            />
          </div>
          <a
            className="button primary"
            href={wasteHref(`report/${destination.id}`, wasteType)}
          >
            抵達後回報
          </a>
          {qr && (
            <img src={qr} alt="手機接續導航 QR Code" width="180" height="180" />
          )}
          <p className="tiny">
            QR 只分享桶連結，不含帳號憑證；本機網址需可連線才可使用。
          </p>
        </>
      ) : (
        !alternatives.loading && <p>目前沒有其他可用桶</p>
      )}
      <a className="back-link" href={wasteHref("map", wasteType)}>
        結束導航
      </a>
    </main>
  );
}
