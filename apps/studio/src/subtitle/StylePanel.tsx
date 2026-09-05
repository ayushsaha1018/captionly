import type { SubtitleStyle, SafeZonePreset } from "@captionly/engine";
import { SAFE_ZONES } from "./SafeZones";

type Props = {
  style: SubtitleStyle;
  onStyleChange: (s: SubtitleStyle) => void;
  safeZone: SafeZonePreset;
  onSafeZoneChange: (z: SafeZonePreset) => void;
};

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-2">
    <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
      {label}
    </label>
    {children}
  </div>
);

const FONTS = [
  "Inter, system-ui, sans-serif",
  "Georgia, serif",
  "'Courier New', monospace",
  "Impact, sans-serif",
  "'Arial Black', sans-serif",
];

export function StylePanel({ style, onStyleChange, safeZone, onSafeZoneChange }: Props) {
  const set = <K extends keyof SubtitleStyle>(k: K, v: SubtitleStyle[K]) =>
    onStyleChange({ ...style, [k]: v });

  return (
    <aside className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5 shadow-lg h-fit">
      <div>
        <h2 className="text-sm font-semibold text-card-foreground">Subtitle Style</h2>
        <p className="text-xs text-ink-muted mt-1">Applies to every line in the project.</p>
      </div>

      <Row label="Font family">
        <select
          value={style.fontFamily}
          onChange={(e) => set("fontFamily", e.target.value)}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
        >
          {FONTS.map((f) => (
            <option key={f} value={f}>
              {f.split(",")[0].replace(/'/g, "")}
            </option>
          ))}
        </select>
      </Row>

      <div className="grid grid-cols-2 gap-3">
        <Row label="Weight">
          <select
            value={style.fontWeight}
            onChange={(e) => set("fontWeight", +e.target.value as SubtitleStyle["fontWeight"])}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          >
            <option value={400}>Regular</option>
            <option value={600}>Semibold</option>
            <option value={700}>Bold</option>
            <option value={900}>Black</option>
          </select>
        </Row>
        <Row label={`Size (${style.fontSize}px)`}>
          <input
            type="range"
            min={32}
            max={160}
            step={2}
            value={style.fontSize}
            onChange={(e) => set("fontSize", +e.target.value)}
            className="w-full accent-[hsl(var(--primary))]"
          />
        </Row>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Row label="Inactive color">
          <input
            type="color"
            value={style.color}
            onChange={(e) => set("color", e.target.value)}
            className="h-10 w-full rounded-md bg-transparent border border-border cursor-pointer"
          />
        </Row>
        <Row label="Active color">
          <input
            type="color"
            value={style.activeColor}
            onChange={(e) => set("activeColor", e.target.value)}
            className="h-10 w-full rounded-md bg-transparent border border-border cursor-pointer"
          />
        </Row>
      </div>

      <Row label={`Stroke width (${style.strokeWidth}px)`}>
        <input
          type="range"
          min={0}
          max={20}
          step={1}
          value={style.strokeWidth}
          onChange={(e) => set("strokeWidth", +e.target.value)}
          className="w-full accent-[hsl(var(--primary))]"
        />
      </Row>

      <Row label={`Active scale (${style.activeScale.toFixed(2)}x)`}>
        <input
          type="range"
          min={1}
          max={2}
          step={0.05}
          value={style.activeScale}
          onChange={(e) => set("activeScale", +e.target.value)}
          className="w-full accent-[hsl(var(--primary))]"
        />
      </Row>

      <Row label={`Shadow blur (${style.shadowBlur}px)`}>
        <input
          type="range"
          min={0}
          max={64}
          step={2}
          value={style.shadowBlur}
          onChange={(e) => set("shadowBlur", +e.target.value)}
          className="w-full accent-[hsl(var(--primary))]"
        />
      </Row>

      <div className="border-t border-border pt-4 flex flex-col gap-4">
        <Row label={`Box width (${style.boxWidth}px)`}>
          <input
            type="range"
            min={300}
            max={1900}
            step={20}
            value={style.boxWidth}
            onChange={(e) => set("boxWidth", +e.target.value)}
            className="w-full accent-[hsl(var(--primary))]"
          />
        </Row>
        <Row label="Wrap grows from">
          <select
            value={style.boxAnchor}
            onChange={(e) => set("boxAnchor", e.target.value as typeof style.boxAnchor)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          >
            <option value="bottom">Bottom (grows upward)</option>
            <option value="top">Top (grows downward)</option>
            <option value="center">Center (grows both ways)</option>
          </select>
        </Row>
      </div>

      <div className="border-t border-border pt-4 flex flex-col gap-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-card-foreground">
          Background
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <Row label="Color">
            <input
              type="color"
              value={style.bgColor}
              onChange={(e) => set("bgColor", e.target.value)}
              className="h-10 w-full rounded-md bg-transparent border border-border cursor-pointer"
            />
          </Row>
          <Row label={`Opacity (${style.bgOpacity.toFixed(2)})`}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={style.bgOpacity}
              onChange={(e) => set("bgOpacity", +e.target.value)}
              className="w-full accent-[hsl(var(--primary))]"
            />
          </Row>
        </div>
        <Row label={`Corner radius (${style.bgRadius}px)`}>
          <input
            type="range"
            min={0}
            max={64}
            step={1}
            value={style.bgRadius}
            onChange={(e) => set("bgRadius", +e.target.value)}
            className="w-full accent-[hsl(var(--primary))]"
          />
        </Row>
        <div className="grid grid-cols-2 gap-3">
          <Row label={`Padding X (${style.bgPaddingX}px)`}>
            <input
              type="range"
              min={0}
              max={80}
              step={2}
              value={style.bgPaddingX}
              onChange={(e) => set("bgPaddingX", +e.target.value)}
              className="w-full accent-[hsl(var(--primary))]"
            />
          </Row>
          <Row label={`Padding Y (${style.bgPaddingY}px)`}>
            <input
              type="range"
              min={0}
              max={60}
              step={2}
              value={style.bgPaddingY}
              onChange={(e) => set("bgPaddingY", +e.target.value)}
              className="w-full accent-[hsl(var(--primary))]"
            />
          </Row>
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <Row label="Safe zone overlay">
          <select
            value={safeZone}
            onChange={(e) => onSafeZoneChange(e.target.value as SafeZonePreset)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          >
            <option value="none">None</option>
            {Object.entries(SAFE_ZONES).map(([key, meta]) => (
              <option key={key} value={key}>
                {meta.label}
              </option>
            ))}
          </select>
        </Row>
      </div>
    </aside>
  );
}
