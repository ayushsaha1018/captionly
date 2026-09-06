import type { SubtitleStyle, SafeZonePreset } from "@captionly/engine";
import { SAFE_ZONES } from "./SafeZones";
import { useStudioStore } from "@/store";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

type Props = {
  style: SubtitleStyle;
  onFieldChange: <K extends keyof SubtitleStyle>(key: K, value: SubtitleStyle[K]) => void;
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

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Row label={label}>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={label}
            className="h-10 w-full rounded-md border border-border shadow-sm transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring motion-reduce:transition-none motion-reduce:hover:scale-100"
            style={{ backgroundColor: value }}
          />
        </PopoverTrigger>
        <PopoverContent className="w-48 space-y-2">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-10 w-full cursor-pointer rounded-md border border-border bg-transparent"
          />
          <Input value={value} onChange={(e) => onChange(e.target.value)} className="text-xs" />
        </PopoverContent>
      </Popover>
    </Row>
  );
}

export function StylePanel({ style, onFieldChange, safeZone, onSafeZoneChange }: Props) {
  const video = useStudioStore((s) => s.video);
  const targetCategory = video && video.width < video.height ? "9:16" : "16:9";

  const recommendedEntries = Object.entries(SAFE_ZONES).filter(
    ([, m]) => m.category === targetCategory,
  );
  const otherEntries = Object.entries(SAFE_ZONES).filter(([, m]) => m.category !== targetCategory);

  const set = <K extends keyof SubtitleStyle>(k: K, v: SubtitleStyle[K]) => onFieldChange(k, v);

  return (
    <aside className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5 shadow-lg h-fit">
      <div>
        <h2 className="text-sm font-semibold text-card-foreground">Subtitle Style</h2>
        <p className="text-xs text-ink-muted mt-1">Applies to every line in the project.</p>
      </div>

      <Row label="Font family">
        <Select value={style.fontFamily} onValueChange={(v) => set("fontFamily", v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONTS.map((f) => (
              <SelectItem key={f} value={f}>
                {f.split(",")[0].replace(/'/g, "")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Row>

      <div className="grid grid-cols-2 gap-3">
        <Row label="Weight">
          <Select
            value={String(style.fontWeight)}
            onValueChange={(v) => set("fontWeight", +v as SubtitleStyle["fontWeight"])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="400">Regular</SelectItem>
              <SelectItem value="600">Semibold</SelectItem>
              <SelectItem value="700">Bold</SelectItem>
              <SelectItem value="900">Black</SelectItem>
            </SelectContent>
          </Select>
        </Row>
        <Row label={`Size (${style.fontSize}px)`}>
          <Slider
            value={[style.fontSize]}
            min={32}
            max={160}
            step={2}
            onValueChange={([v]) => set("fontSize", v)}
          />
        </Row>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <ColorField label="Inactive color" value={style.color} onChange={(v) => set("color", v)} />
        <ColorField
          label="Active color"
          value={style.activeColor}
          onChange={(v) => set("activeColor", v)}
        />
      </div>

      <div className="border-t border-border pt-4 grid grid-cols-2 gap-3">
        <ColorField label="Stroke color" value={style.stroke} onChange={(v) => set("stroke", v)} />
        <Row label={`Stroke width (${style.strokeWidth}px)`}>
          <Slider
            value={[style.strokeWidth]}
            min={0}
            max={20}
            step={1}
            onValueChange={([v]) => set("strokeWidth", v)}
          />
        </Row>
      </div>

      <Row label={`Active scale (${style.activeScale.toFixed(2)}x)`}>
        <Slider
          value={[style.activeScale]}
          min={1}
          max={2}
          step={0.05}
          onValueChange={([v]) => set("activeScale", v)}
        />
      </Row>

      <div className="border-t border-border pt-4 flex flex-col gap-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-card-foreground">
          Shadow &amp; glow
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <ColorField
            label="Shadow color"
            value={style.shadowColor}
            onChange={(v) => set("shadowColor", v)}
          />
          <Row label={`Blur (${style.shadowBlur}px)`}>
            <Slider
              value={[style.shadowBlur]}
              min={0}
              max={64}
              step={2}
              onValueChange={([v]) => set("shadowBlur", v)}
            />
          </Row>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Row label={`Offset X (${style.shadowOffsetX}px)`}>
            <Slider
              value={[style.shadowOffsetX]}
              min={-40}
              max={40}
              step={1}
              onValueChange={([v]) => set("shadowOffsetX", v)}
            />
          </Row>
          <Row label={`Offset Y (${style.shadowOffsetY}px)`}>
            <Slider
              value={[style.shadowOffsetY]}
              min={-40}
              max={40}
              step={1}
              onValueChange={([v]) => set("shadowOffsetY", v)}
            />
          </Row>
        </div>
        <Row label={`Active glow boost (${style.activeGlowMultiplier.toFixed(1)}x)`}>
          <Slider
            value={[style.activeGlowMultiplier]}
            min={1}
            max={4}
            step={0.1}
            onValueChange={([v]) => set("activeGlowMultiplier", v)}
          />
        </Row>
      </div>

      <div className="border-t border-border pt-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-card-foreground">
            Text gradient
          </h3>
          <Switch
            checked={style.textGradientEnabled}
            onCheckedChange={(v) => set("textGradientEnabled", v)}
          />
        </div>
        {style.textGradientEnabled && (
          <div className="grid grid-cols-2 gap-3">
            <ColorField
              label="Gradient to"
              value={style.textGradientTo}
              onChange={(v) => set("textGradientTo", v)}
            />
            <Row label={`Angle (${style.textGradientAngle}°)`}>
              <Slider
                value={[style.textGradientAngle]}
                min={0}
                max={360}
                step={5}
                onValueChange={([v]) => set("textGradientAngle", v)}
              />
            </Row>
          </div>
        )}
      </div>

      <div className="border-t border-border pt-4 flex flex-col gap-4">
        <Row label={`Box width (${style.boxWidth}px)`}>
          <Slider
            value={[style.boxWidth]}
            min={300}
            max={1900}
            step={20}
            onValueChange={([v]) => set("boxWidth", v)}
          />
        </Row>
        <Row label="Wrap grows from">
          <Select
            value={style.boxAnchor}
            onValueChange={(v) => set("boxAnchor", v as SubtitleStyle["boxAnchor"])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bottom">Bottom (grows upward)</SelectItem>
              <SelectItem value="top">Top (grows downward)</SelectItem>
              <SelectItem value="center">Center (grows both ways)</SelectItem>
            </SelectContent>
          </Select>
        </Row>
      </div>

      <div className="border-t border-border pt-4 flex flex-col gap-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-card-foreground">
          Background
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <ColorField label="Color" value={style.bgColor} onChange={(v) => set("bgColor", v)} />
          <Row label={`Opacity (${style.bgOpacity.toFixed(2)})`}>
            <Slider
              value={[style.bgOpacity]}
              min={0}
              max={1}
              step={0.05}
              onValueChange={([v]) => set("bgOpacity", v)}
            />
          </Row>
        </div>
        <Row label={`Corner radius (${style.bgRadius}px)`}>
          <Slider
            value={[style.bgRadius]}
            min={0}
            max={64}
            step={1}
            onValueChange={([v]) => set("bgRadius", v)}
          />
        </Row>
        <div className="grid grid-cols-2 gap-3">
          <Row label={`Padding X (${style.bgPaddingX}px)`}>
            <Slider
              value={[style.bgPaddingX]}
              min={0}
              max={80}
              step={2}
              onValueChange={([v]) => set("bgPaddingX", v)}
            />
          </Row>
          <Row label={`Padding Y (${style.bgPaddingY}px)`}>
            <Slider
              value={[style.bgPaddingY]}
              min={0}
              max={60}
              step={2}
              onValueChange={([v]) => set("bgPaddingY", v)}
            />
          </Row>
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <Row label="Safe zone overlay">
          <Select value={safeZone} onValueChange={(v) => onSafeZoneChange(v as SafeZonePreset)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectGroup>
                <SelectLabel>{`Recommended (${targetCategory})`}</SelectLabel>
                {recommendedEntries.map(([key, meta]) => (
                  <SelectItem key={key} value={key}>
                    {meta.label}
                  </SelectItem>
                ))}
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>Other formats</SelectLabel>
                {otherEntries.map(([key, meta]) => (
                  <SelectItem key={key} value={key}>
                    {meta.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Row>
      </div>
    </aside>
  );
}
