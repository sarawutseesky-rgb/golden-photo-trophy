export async function compressImage(file: File, maxWidth = 1200, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  return await new Promise<Blob>((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("compress failed"))), "image/jpeg", quality),
  );
}

export async function getImageDims(blob: Blob): Promise<{ width: number; height: number }> {
  const bm = await createImageBitmap(blob);
  return { width: bm.width, height: bm.height };
}