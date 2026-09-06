import type { SubtitleStyle, SubtitlePosition } from "@captionly/engine";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NumberField } from "@/components/ui/number-field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

type Props = {
  style: SubtitleStyle;
  onFieldChange: <K extends keyof SubtitleStyle>(key: K, value: SubtitleStyle[K]) => void;
  position: SubtitlePosition;
  onPositionFieldChange: <K extends keyof SubtitlePosition>(
    key: K,
    value: SubtitlePosition[K],
  ) => void;
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
  "Inter, system-ui, -apple-system, sans-serif",
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
          <Input
            value={value}
            onChange={(e) => {
              const v = e.target.value;
              if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(v);
            }}
            className="text-xs"
          />
        </PopoverContent>
      </Popover>
    </Row>
  );
}

export function StylePanel({ style, onFieldChange, position, onPositionFieldChange }: Props) {
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
        <Row label="Size">
          <NumberField
            value={style.fontSize}
            min={32}
            max={160}
            step={2}
            suffix="px"
            onChange={(v) => set("fontSize", v)}
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
        <Row label="Stroke width">
          <NumberField
            value={style.strokeWidth}
            min={0}
            max={20}
            step={1}
            suffix="px"
            onChange={(v) => set("strokeWidth", v)}
          />
        </Row>
      </div>

      <Row label="Active scale">
        <NumberField
          value={style.activeScale}
          min={1}
          max={2}
          step={0.05}
          suffix="x"
          onChange={(v) => set("activeScale", v)}
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
          <Row label="Blur">
            <NumberField
              value={style.shadowBlur}
              min={0}
              max={64}
              step={2}
              suffix="px"
              onChange={(v) => set("shadowBlur", v)}
            />
          </Row>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Row label="Offset X">
            <NumberField
              value={style.shadowOffsetX}
              min={-40}
              max={40}
              step={1}
              suffix="px"
              onChange={(v) => set("shadowOffsetX", v)}
            />
          </Row>
          <Row label="Offset Y">
            <NumberField
              value={style.shadowOffsetY}
              min={-40}
              max={40}
              step={1}
              suffix="px"
              onChange={(v) => set("shadowOffsetY", v)}
            />
          </Row>
        </div>
        <Row label="Active glow boost">
          <NumberField
            value={style.activeGlowMultiplier}
            min={1}
            max={4}
            step={0.1}
            suffix="x"
            onChange={(v) => set("activeGlowMultiplier", v)}
          />
        </Row>
      </div>

      <div className="border-t border-border pt-4 flex flex-col gap-4">
        <Row label="Box width">
          <NumberField
            value={style.boxWidth}
            min={300}
            max={1900}
            step={20}
            suffix="px"
            onChange={(v) => set("boxWidth", v)}
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
        <Row label="Vertical position">
          <NumberField
            value={position.y}
            min={50}
            max={98}
            step={1}
            suffix="%"
            onChange={(v) => onPositionFieldChange("y", v)}
          />
        </Row>
      </div>

      <div className="border-t border-border pt-4 flex flex-col gap-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-card-foreground">
          Background
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <ColorField label="Color" value={style.bgColor} onChange={(v) => set("bgColor", v)} />
          <Row label="Opacity">
            <NumberField
              value={style.bgOpacity}
              min={0}
              max={1}
              step={0.05}
              onChange={(v) => set("bgOpacity", v)}
            />
          </Row>
        </div>
        <Row label="Corner radius">
          <NumberField
            value={style.bgRadius}
            min={0}
            max={64}
            step={1}
            suffix="px"
            onChange={(v) => set("bgRadius", v)}
          />
        </Row>
        <div className="grid grid-cols-2 gap-3">
          <Row label="Padding X">
            <NumberField
              value={style.bgPaddingX}
              min={0}
              max={80}
              step={2}
              suffix="px"
              onChange={(v) => set("bgPaddingX", v)}
            />
          </Row>
          <Row label="Padding Y">
            <NumberField
              value={style.bgPaddingY}
              min={0}
              max={60}
              step={2}
              suffix="px"
              onChange={(v) => set("bgPaddingY", v)}
            />
          </Row>
        </div>
      </div>
    </aside>
  );
}
