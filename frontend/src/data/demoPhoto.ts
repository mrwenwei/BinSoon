type PhotoPurpose = "report" | "completion" | "site";

/** A bin illustration with a permanent demo disclosure, never field evidence. */
export function demoPhotoSvg(purpose: PhotoPurpose = "report") {
  const tokens = getComputedStyle(document.documentElement);
  const color = (name: string) => tokens.getPropertyValue(`--${name}`).trim();
  const title = {
    report: "桶況回報",
    completion: "工單完成照",
    site: "工單現況照",
  }[purpose];
  return (
    "data:image/svg+xml," +
    encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">
    <rect width="640" height="480" fill="${color("chrome")}"/>
    <path d="M64 354H576" stroke="${color("line-control")}" stroke-width="4"/>
    <path d="M235 156H405L388 342H252Z" fill="${color("mint")}" stroke="${color("text-on-light")}" stroke-width="8"/>
    <path d="M222 142H418M287 125V111H353V125M285 192V303M320 192V303M355 192V303" fill="none" stroke="${color("text-on-light")}" stroke-width="12" stroke-linecap="round"/>
    <circle cx="269" cy="352" r="12" fill="${color("text-muted")}"/><circle cx="371" cy="352" r="12" fill="${color("text-muted")}"/>
    <text x="32" y="55" fill="${color("teal")}" font-family="sans-serif" font-size="30" font-weight="bold">${title}</text>

    <text x="320" y="452" text-anchor="middle" fill="${color("text-muted")}" font-family="sans-serif" font-size="20">BinSoon · BinU</text>
  </svg>`)
  );
}

/** Generate a real uploadable PNG from the same bin illustration. */
export async function createDemoPhoto(
  purpose: PhotoPurpose = "report",
): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("無法產生照片，請重試。");
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("照片產生失敗，請重試。"));
    image.src = demoPhotoSvg(purpose);
  });
  ctx.drawImage(image, 0, 0);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (value) =>
        value ? resolve(value) : reject(new Error("照片產生失敗，請重試。")),
      "image/png",
    ),
  );
  return new File([blob], `demo-${purpose}.png`, { type: "image/png" });
}
