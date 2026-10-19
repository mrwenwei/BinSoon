// Shared client-side checks; the API remains authoritative for format and ownership.
export async function validatePhoto(file: File): Promise<void> {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 5 * 1024 * 1024
  )
    throw new Error("請選 JPEG、PNG 或 WebP，大小最多 5 MiB。");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("照片無法解碼，請重新選擇。");
  }
  const pixels = bitmap.width * bitmap.height;
  bitmap.close();
  if (pixels > 20000000) throw new Error("照片最多 2000 萬像素，請重新選擇。");
}
