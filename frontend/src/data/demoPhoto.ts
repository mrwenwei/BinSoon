/** A real uploadable PNG, visibly marked so it cannot pass for field evidence. */
export async function createDemoPhoto(
  purpose: "report" | "completion" | "site" = "report",
): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("無法產生示意照片，請選擇照片檔案。");
  const tokens = getComputedStyle(document.documentElement);
  ctx.fillStyle = tokens.getPropertyValue("--chrome").trim();
  ctx.fillRect(0, 0, 640, 480);
  ctx.fillStyle = tokens.getPropertyValue("--teal").trim();
  ctx.font = "bold 56px sans-serif";
  ctx.fillText("DEMO", 48, 110);
  ctx.fillStyle = tokens.getPropertyValue("--text").trim();
  ctx.font = "bold 32px sans-serif";
  ctx.fillText("模擬測試 · 非現場照片", 48, 210);
  ctx.font = "24px sans-serif";
  const title = {
    report: "回報",
    completion: "工單完成照",
    site: "工單現況照",
  }[purpose];
  ctx.fillText(`僅供${title}流程測試`, 48, 285);
  ctx.fillText("BinSoon", 48, 400);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (value) =>
        value
          ? resolve(value)
          : reject(new Error("示意照片產生失敗，請重試。")),
      "image/png",
    ),
  );
  return new File([blob], `demo-${purpose}.png`, { type: "image/png" });
}
