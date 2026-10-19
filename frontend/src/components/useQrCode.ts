import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { token } from "../map/basemapStyle";

export function useQrCode(url: string, width: number) {
  const [result, setResult] = useState({ url: "", image: "" });
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(url, {
      width,
      margin: 2,
      // QR 需要深色碼點＋淺底才好掃：用 text-on-light 與 map-road token。
      color: { dark: token("text-on-light"), light: token("map-road") },
    })
      .then((image) => {
        if (active) setResult({ url, image });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [url, width]);
  // Do not briefly display a QR for the previous destination during rerouting.
  return result.url === url ? result.image : "";
}
