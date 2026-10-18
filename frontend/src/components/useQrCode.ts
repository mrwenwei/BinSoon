import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function useQrCode(url: string, width: number) {
  const [result, setResult] = useState({ url: "", image: "" });
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(url, {
      width,
      margin: 2,
      color: { dark: "#293e35", light: "#fffef8" },
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
