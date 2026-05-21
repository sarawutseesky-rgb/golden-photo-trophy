import { Camera, Aperture, Timer, Gauge, Maximize2, CalendarDays } from "lucide-react";
import type { PhotoExif } from "@/lib/exif";

export function ExifInfo({ exif }: { exif: PhotoExif | null | undefined }) {
  if (!exif) return null;
  const cameraText = [exif.make, exif.model].filter(Boolean).join(" ").trim();
  const items: Array<{ icon: React.ComponentType<any>; label: string; value: string }> = [];
  if (cameraText) items.push({ icon: Camera, label: "Camera", value: cameraText });
  if (exif.lens) items.push({ icon: Camera, label: "Lens", value: exif.lens });
  if (exif.focal_length) items.push({ icon: Maximize2, label: "Focal", value: `${exif.focal_length}mm` });
  if (exif.aperture) items.push({ icon: Aperture, label: "Aperture", value: `f/${exif.aperture}` });
  if (exif.shutter_speed) items.push({ icon: Timer, label: "Shutter", value: exif.shutter_speed });
  if (exif.iso) items.push({ icon: Gauge, label: "ISO", value: String(exif.iso) });
  if (exif.taken_at) {
    const d = new Date(exif.taken_at);
    if (!Number.isNaN(d.getTime())) {
      items.push({
        icon: CalendarDays,
        label: "Taken",
        value: d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }),
      });
    }
  }
  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <Camera className="h-3.5 w-3.5" />
        Photo info
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
        {items.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-start gap-2 min-w-0">
            <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0">
              <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
              <dd className="truncate font-medium">{value}</dd>
            </div>
          </div>
        ))}
      </dl>
    </div>
  );
}