import type { SafeZonePreset } from "@captionly/engine";

export interface SafeZoneMeta {
  label: string;
  category: "9:16" | "16:9";
  insetX: number;
  insetY: number;
}

export const SAFE_ZONES: Record<Exclude<SafeZonePreset, "none">, SafeZoneMeta> = {
  tiktok: { label: "TikTok (9:16)", category: "9:16", insetX: 6, insetY: 18 },
  instagram: { label: "Instagram Reels (9:16)", category: "9:16", insetX: 6, insetY: 14 },
  youtube: { label: "YouTube (16:9)", category: "16:9", insetX: 5, insetY: 10 },
};

export function SafeZones({ preset }: { preset: SafeZonePreset }) {
  if (preset === "none") return null;
  const z = SAFE_ZONES[preset];
  if (!z) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <div
        className="absolute border-2 border-dashed border-edit/70 bg-edit/5"
        style={{
          left: `${z.insetX}%`,
          right: `${z.insetX}%`,
          top: `${z.insetY}%`,
          bottom: `${z.insetY}%`,
        }}
      >
        <span className="absolute top-1 left-1.5 rounded bg-void/80 px-2 py-0.5 text-[10px] font-medium text-ink">
          {z.label} safe zone
        </span>
      </div>
    </div>
  );
}
