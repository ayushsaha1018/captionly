import type { SafeZonePreset } from "@captionly/engine";

const ZONES: Record<Exclude<SafeZonePreset, "none">, { label: string; insetX: number; insetY: number; ratio?: string }> = {
  instagram: { label: "Instagram 9:16", insetX: 6, insetY: 14 },
  tiktok: { label: "TikTok 9:16", insetX: 6, insetY: 18 },
  youtube: { label: "YouTube 16:9", insetX: 5, insetY: 10 },
};

export function SafeZones({ preset }: { preset: SafeZonePreset }) {
  if (preset === "none") return null;
  const z = ZONES[preset];
  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <div
        className="absolute border-2 border-dashed border-[hsl(var(--accent-foreground)/0.7)] bg-[hsl(var(--accent)/0.05)]"
        style={{
          left: `${z.insetX}%`,
          right: `${z.insetX}%`,
          top: `${z.insetY}%`,
          bottom: `${z.insetY}%`,
        }}
      >
        <span className="absolute -top-6 left-0 text-xs font-medium text-white/80 bg-black/40 px-2 py-0.5 rounded">
          {z.label} safe zone
        </span>
      </div>
    </div>
  );
}
