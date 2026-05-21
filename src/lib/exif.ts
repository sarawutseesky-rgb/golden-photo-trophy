import exifr from "exifr";

export type PhotoExif = {
  make?: string;
  model?: string;
  lens?: string;
  focal_length?: number; // mm
  aperture?: number; // f-number
  shutter_speed?: string; // e.g. "1/200"
  iso?: number;
  taken_at?: string; // ISO string
};

function formatShutter(exposure: number | undefined): string | undefined {
  if (!exposure || !isFinite(exposure)) return undefined;
  if (exposure >= 1) return `${Math.round(exposure * 10) / 10}s`;
  const denom = Math.round(1 / exposure);
  return `1/${denom}`;
}

export async function extractExif(file: File | Blob): Promise<PhotoExif | null> {
  try {
    const data = await exifr.parse(file, {
      tiff: true,
      exif: true,
      pick: [
        "Make",
        "Model",
        "LensModel",
        "LensMake",
        "FocalLength",
        "FNumber",
        "ExposureTime",
        "ISO",
        "ISOSpeedRatings",
        "DateTimeOriginal",
      ],
    });
    if (!data) return null;
    const exif: PhotoExif = {
      make: data.Make ? String(data.Make).trim() : undefined,
      model: data.Model ? String(data.Model).trim() : undefined,
      lens: data.LensModel ? String(data.LensModel).trim() : undefined,
      focal_length: typeof data.FocalLength === "number" ? Math.round(data.FocalLength) : undefined,
      aperture: typeof data.FNumber === "number" ? Math.round(data.FNumber * 10) / 10 : undefined,
      shutter_speed: formatShutter(typeof data.ExposureTime === "number" ? data.ExposureTime : undefined),
      iso: typeof data.ISO === "number" ? data.ISO : typeof data.ISOSpeedRatings === "number" ? data.ISOSpeedRatings : undefined,
      taken_at: data.DateTimeOriginal ? new Date(data.DateTimeOriginal).toISOString() : undefined,
    };
    // Drop empty
    const hasAny = Object.values(exif).some((v) => v !== undefined && v !== "");
    return hasAny ? exif : null;
  } catch {
    return null;
  }
}