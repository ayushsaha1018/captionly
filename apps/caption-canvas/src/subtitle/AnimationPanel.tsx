import {
  ANIMATION_LABELS,
  defaultOptionsFor,
  type AnimationConfig,
  type AnimationType,
  type ColorFillOptions,
  type TypewriterOptions,
  type RollUpOptions,
  type PaintOnOptions,
  type PopOnOptions,
  type WipeOptions,
  type FlapBoardOptions,
  type TickerOptions,
  type DigitalMatrixOptions,
} from "subtitle-renderer";

type Props = {
  animation: AnimationConfig;
  onChange: (a: AnimationConfig) => void;
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
  "colorFill",
  "typewriter",
  "rollUp",
  "paintOn",
  "popOn",
  "wipe",
  "flapBoard",
  "ticker",
  "digitalMatrix",
];

export function AnimationPanel({ animation, onChange }: Props) {
  const setType = (type: AnimationType) => {
    onChange({ type, options: defaultOptionsFor(type) } as AnimationConfig);
  };

  const setOptions = <T extends AnimationConfig["options"]>(opts: T) => {
    onChange({ ...animation, options: opts } as AnimationConfig);
  };

  return (
    <aside className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5 shadow-lg h-fit">
      <div>
        <h2 className="text-sm font-semibold text-card-foreground">Animation</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Pick a caption animation. Speed adapts to each line's start/end time.
        </p>
      </div>

      <Row label="Type">
        <select
          value={animation.type}
          onChange={(e) => setType(e.target.value as AnimationType)}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
        >
          {ANIM_TYPES.map((t) => (
            <option key={t} value={t}>
              {ANIMATION_LABELS[t]}
            </option>
          ))}
        </select>
      </Row>

      {animation.type === "colorFill" && (
        <Row label="Transition">
          <select
            value={animation.options.transition}
            onChange={(e) =>
              setOptions<ColorFillOptions>({
                transition: e.target.value as ColorFillOptions["transition"],
              })
            }
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          >
            <option value="hardCut">Hard cut</option>
            <option value="gradient">Gradient (left-to-right)</option>
          </select>
        </Row>
      )}

      {animation.type === "typewriter" && (
        <>
          <Row label="Cursor">
            <select
              value={animation.options.cursor}
              onChange={(e) =>
                setOptions<TypewriterOptions>({
                  ...animation.options,
                  cursor: e.target.value as TypewriterOptions["cursor"],
                })
              }
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="|">Line ( | )</option>
              <option value="_">Underscore ( _ )</option>
              <option value=".">Dot ( . )</option>
            </select>
          </Row>
          <Row label={`Blink rate (${animation.options.blinkRate.toFixed(1)} Hz)`}>
            <input
              type="range" min={0} max={4} step={0.1}
              value={animation.options.blinkRate}
              onChange={(e) =>
                setOptions<TypewriterOptions>({
                  ...animation.options,
                  blinkRate: +e.target.value,
                })
              }
              className="w-full accent-[hsl(var(--primary))]"
            />
          </Row>
          <Row label={`Max speed cap (${animation.options.maxCps} chars/s)`}>
            <input
              type="range" min={10} max={80} step={1}
              value={animation.options.maxCps}
              onChange={(e) =>
                setOptions<TypewriterOptions>({
                  ...animation.options,
                  maxCps: +e.target.value,
                })
              }
              className="w-full accent-[hsl(var(--primary))]"
            />
          </Row>
        </>
      )}

      {animation.type === "rollUp" && (
        <>
          <Row label={`Line limit (${animation.options.lineLimit})`}>
            <input
              type="range" min={1} max={5} step={1}
              value={animation.options.lineLimit}
              onChange={(e) =>
                setOptions<RollUpOptions>({
                  ...animation.options,
                  lineLimit: +e.target.value,
                })
              }
              className="w-full accent-[hsl(var(--primary))]"
            />
          </Row>
          <Row label="Transition">
            <select
              value={animation.options.transition}
              onChange={(e) =>
                setOptions<RollUpOptions>({
                  ...animation.options,
                  transition: e.target.value as RollUpOptions["transition"],
                })
              }
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="hardCut">Hard cut</option>
              <option value="soft">Soft scroll</option>
            </select>
          </Row>
          <Row label={`Line spacing (${animation.options.lineSpacing}px)`}>
            <input
              type="range" min={0} max={64} step={2}
              value={animation.options.lineSpacing}
              onChange={(e) =>
                setOptions<RollUpOptions>({
                  ...animation.options,
                  lineSpacing: +e.target.value,
                })
              }
              className="w-full accent-[hsl(var(--primary))]"
            />
          </Row>
        </>
      )}

      {animation.type === "paintOn" && (
        <>
          <Row label="Direction">
            <select
              value={animation.options.direction}
              onChange={(e) =>
                setOptions<PaintOnOptions>({
                  ...animation.options,
                  direction: e.target.value as PaintOnOptions["direction"],
                })
              }
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="ltr">Left → Right</option>
              <option value="rtl">Right → Left (Arabic / Hebrew)</option>
            </select>
          </Row>
          <Row label={`Max speed cap (${animation.options.maxCps} chars/s)`}>
            <input
              type="range" min={10} max={80} step={1}
              value={animation.options.maxCps}
              onChange={(e) =>
                setOptions<PaintOnOptions>({
                  ...animation.options,
                  maxCps: +e.target.value,
                })
              }
              className="w-full accent-[hsl(var(--primary))]"
            />
          </Row>
        </>
      )}

      {animation.type === "popOn" && (
        <>
          <Row label={`Pop scale (${animation.options.popScale.toFixed(2)}x)`}>
            <input
              type="range" min={1} max={1.6} step={0.01}
              value={animation.options.popScale}
              onChange={(e) =>
                setOptions<PopOnOptions>({
                  ...animation.options,
                  popScale: +e.target.value,
                })
              }
              className="w-full accent-[hsl(var(--primary))]"
            />
          </Row>
          <Row label={`Pop duration (${animation.options.popDuration.toFixed(2)}s)`}>
            <input
              type="range" min={0.05} max={0.8} step={0.01}
              value={animation.options.popDuration}
              onChange={(e) =>
                setOptions<PopOnOptions>({
                  ...animation.options,
                  popDuration: +e.target.value,
                })
              }
              className="w-full accent-[hsl(var(--primary))]"
            />
          </Row>
        </>
      )}

      {animation.type === "wipe" && (
        <Row label="Direction">
          <select
            value={animation.options.direction}
            onChange={(e) =>
              setOptions<WipeOptions>({
                direction: e.target.value as WipeOptions["direction"],
              })
            }
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          >
            <option value="ltr">Left → Right</option>
            <option value="rtl">Right → Left</option>
            <option value="ttb">Top → Bottom</option>
            <option value="btt">Bottom → Top</option>
          </select>
        </Row>
      )}

      {animation.type === "flapBoard" && (
        <>
          <Row label={`Flap duration (${animation.options.flapDuration.toFixed(2)}s)`}>
            <input
              type="range" min={0.1} max={2} step={0.05}
              value={animation.options.flapDuration}
              onChange={(e) =>
                setOptions<FlapBoardOptions>({
                  ...animation.options,
                  flapDuration: +e.target.value,
                })
              }
              className="w-full accent-[hsl(var(--primary))]"
            />
          </Row>
          <Row label={`Cycles per char (${animation.options.cyclesPerChar})`}>
            <input
              type="range" min={2} max={20} step={1}
              value={animation.options.cyclesPerChar}
              onChange={(e) =>
                setOptions<FlapBoardOptions>({
                  ...animation.options,
                  cyclesPerChar: +e.target.value,
                })
              }
              className="w-full accent-[hsl(var(--primary))]"
            />
          </Row>
        </>
      )}

      {animation.type === "ticker" && (
        <>
          <Row label={`Scroll speed (${animation.options.speed} px/s)`}>
            <input
              type="range" min={50} max={600} step={10}
              value={animation.options.speed}
              onChange={(e) =>
                setOptions<TickerOptions>({
                  ...animation.options,
                  speed: +e.target.value,
                })
              }
              className="w-full accent-[hsl(var(--primary))]"
            />
          </Row>
          <Row label={`Gap (${animation.options.gap}px)`}>
            <input
              type="range" min={0} max={400} step={10}
              value={animation.options.gap}
              onChange={(e) =>
                setOptions<TickerOptions>({
                  ...animation.options,
                  gap: +e.target.value,
                })
              }
              className="w-full accent-[hsl(var(--primary))]"
            />
          </Row>
        </>
      )}

      {animation.type === "digitalMatrix" && (
        <>
          <Row label={`Glow intensity (${animation.options.glowIntensity.toFixed(2)})`}>
            <input
              type="range" min={0} max={1} step={0.05}
              value={animation.options.glowIntensity}
              onChange={(e) =>
                setOptions<DigitalMatrixOptions>({
                  ...animation.options,
                  glowIntensity: +e.target.value,
                })
              }
              className="w-full accent-[hsl(var(--primary))]"
            />
          </Row>
          <Row label={`Glitch jitter (${animation.options.glitchAmplitude}px)`}>
            <input
              type="range" min={0} max={12} step={1}
              value={animation.options.glitchAmplitude}
              onChange={(e) =>
                setOptions<DigitalMatrixOptions>({
                  ...animation.options,
                  glitchAmplitude: +e.target.value,
                })
              }
              className="w-full accent-[hsl(var(--primary))]"
            />
          </Row>
        </>
      )}
    </aside>
  );
}
