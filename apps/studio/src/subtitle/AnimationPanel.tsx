import {
  ANIMATION_LABELS,
  type AnimationConfig,
  type AnimationType,
  type ColorFillOptions,
  type TypewriterOptions,
  type RollUpOptions,
  type PaintOnOptions,
  type PopOnOptions,
  type WipeOptions,
  type FlapBoardOptions,
  type DigitalMatrixOptions,
} from "@captionly/engine";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NumberField } from "@/components/ui/number-field";

type Props = {
  animation: AnimationConfig;
  onTypeChange: (type: AnimationType) => void;
  onOptionChange: (fieldKey: string, options: AnimationConfig["options"]) => void;
};

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-2">
    <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
      {label}
    </label>
    {children}
  </div>
);

const ANIM_TYPES: AnimationType[] = [
  "none",
  "colorFill",
  "typewriter",
  "rollUp",
  "paintOn",
  "popOn",
  "wipe",
  "flapBoard",
  "digitalMatrix",
];

export function AnimationPanel({ animation, onTypeChange, onOptionChange }: Props) {
  return (
    <aside className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5 shadow-lg h-fit">
      <div>
        <h2 className="text-sm font-semibold text-card-foreground">Animation</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Pick a caption animation. Speed adapts to each line's start/end time.
        </p>
      </div>

      <Row label="Type">
        <Select value={animation.type} onValueChange={(v) => onTypeChange(v as AnimationType)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ANIM_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {ANIMATION_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Row>

      {animation.type === "none" && (
        <p className="text-xs text-muted-foreground italic">
          Subtitles display statically without word animations or active highlights.
        </p>
      )}

      {animation.type === "colorFill" && (
        <Row label="Transition">
          <Select
            value={animation.options.transition}
            onValueChange={(v) =>
              onOptionChange("transition", {
                transition: v as ColorFillOptions["transition"],
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hardCut">Hard cut</SelectItem>
              <SelectItem value="gradient">Gradient (left-to-right)</SelectItem>
            </SelectContent>
          </Select>
        </Row>
      )}

      {animation.type === "typewriter" && (
        <>
          <Row label="Cursor">
            <Select
              value={animation.options.cursor}
              onValueChange={(v) =>
                onOptionChange("cursor", {
                  ...animation.options,
                  cursor: v as TypewriterOptions["cursor"],
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="|">Line ( | )</SelectItem>
                <SelectItem value="_">Underscore ( _ )</SelectItem>
                <SelectItem value=".">Dot ( . )</SelectItem>
              </SelectContent>
            </Select>
          </Row>
          <Row label="Blink rate">
            <NumberField
              value={animation.options.blinkRate}
              min={0}
              max={4}
              step={0.1}
              suffix=" Hz"
              onChange={(v) => onOptionChange("blinkRate", { ...animation.options, blinkRate: v })}
            />
          </Row>
          <Row label="Max speed cap">
            <NumberField
              value={animation.options.maxCps}
              min={10}
              max={80}
              step={1}
              suffix=" chars/s"
              onChange={(v) => onOptionChange("maxCps", { ...animation.options, maxCps: v })}
            />
          </Row>
        </>
      )}

      {animation.type === "rollUp" && (
        <>
          <Row label="Line limit">
            <NumberField
              value={animation.options.lineLimit}
              min={1}
              max={5}
              step={1}
              onChange={(v) => onOptionChange("lineLimit", { ...animation.options, lineLimit: v })}
            />
          </Row>
          <Row label="Transition">
            <Select
              value={animation.options.transition}
              onValueChange={(v) =>
                onOptionChange("transition", {
                  ...animation.options,
                  transition: v as RollUpOptions["transition"],
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hardCut">Hard cut</SelectItem>
                <SelectItem value="soft">Soft scroll</SelectItem>
              </SelectContent>
            </Select>
          </Row>
          <Row label="Line spacing">
            <NumberField
              value={animation.options.lineSpacing}
              min={0}
              max={64}
              step={2}
              suffix="px"
              onChange={(v) =>
                onOptionChange("lineSpacing", { ...animation.options, lineSpacing: v })
              }
            />
          </Row>
        </>
      )}

      {animation.type === "paintOn" && (
        <>
          <Row label="Direction">
            <Select
              value={animation.options.direction}
              onValueChange={(v) =>
                onOptionChange("direction", {
                  ...animation.options,
                  direction: v as PaintOnOptions["direction"],
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ltr">Left → Right</SelectItem>
                <SelectItem value="rtl">Right → Left (Arabic / Hebrew)</SelectItem>
              </SelectContent>
            </Select>
          </Row>
          <Row label="Max speed cap">
            <NumberField
              value={animation.options.maxCps}
              min={10}
              max={80}
              step={1}
              suffix=" chars/s"
              onChange={(v) => onOptionChange("maxCps", { ...animation.options, maxCps: v })}
            />
          </Row>
        </>
      )}

      {animation.type === "popOn" && (
        <>
          <Row label="Pop scale">
            <NumberField
              value={animation.options.popScale}
              min={1}
              max={1.6}
              step={0.01}
              suffix="x"
              onChange={(v) => onOptionChange("popScale", { ...animation.options, popScale: v })}
            />
          </Row>
          <Row label="Pop duration">
            <NumberField
              value={animation.options.popDuration}
              min={0.05}
              max={0.8}
              step={0.01}
              suffix="s"
              onChange={(v) =>
                onOptionChange("popDuration", { ...animation.options, popDuration: v })
              }
            />
          </Row>
        </>
      )}

      {animation.type === "wipe" && (
        <Row label="Direction">
          <Select
            value={animation.options.direction}
            onValueChange={(v) =>
              onOptionChange("direction", { direction: v as WipeOptions["direction"] })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ltr">Left → Right</SelectItem>
              <SelectItem value="rtl">Right → Left</SelectItem>
              <SelectItem value="ttb">Top → Bottom</SelectItem>
              <SelectItem value="btt">Bottom → Top</SelectItem>
            </SelectContent>
          </Select>
        </Row>
      )}

      {animation.type === "flapBoard" && (
        <>
          <Row label="Flap duration">
            <NumberField
              value={animation.options.flapDuration}
              min={0.1}
              max={2}
              step={0.05}
              suffix="s"
              onChange={(v) =>
                onOptionChange("flapDuration", { ...animation.options, flapDuration: v })
              }
            />
          </Row>
          <Row label="Cycles per char">
            <NumberField
              value={animation.options.cyclesPerChar}
              min={2}
              max={20}
              step={1}
              onChange={(v) =>
                onOptionChange("cyclesPerChar", { ...animation.options, cyclesPerChar: v })
              }
            />
          </Row>
        </>
      )}

      {animation.type === "digitalMatrix" && (
        <>
          <Row label="Glow intensity">
            <NumberField
              value={animation.options.glowIntensity}
              min={0}
              max={1}
              step={0.05}
              onChange={(v) =>
                onOptionChange("glowIntensity", { ...animation.options, glowIntensity: v })
              }
            />
          </Row>
          <Row label="Glitch jitter">
            <NumberField
              value={animation.options.glitchAmplitude}
              min={0}
              max={12}
              step={1}
              suffix="px"
              onChange={(v) =>
                onOptionChange("glitchAmplitude", { ...animation.options, glitchAmplitude: v })
              }
            />
          </Row>
        </>
      )}
    </aside>
  );
}
