import type { PlayerRef } from "@remotion/player";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useStudioStore } from "@/store";
import { StylePanel } from "@/subtitle/StylePanel";
import { AnimationPanel } from "@/subtitle/AnimationPanel";
import { PresetPicker } from "@/subtitle/PresetPicker";
import { LineList } from "@/lines/LineList";
import { cn } from "@/lib/utils";
import { defaultOptionsFor, type StylePreset } from "@captionly/engine";
import type {
  SubtitleStyle,
  SubtitlePosition,
  AnimationConfig,
  AnimationType,
} from "@captionly/engine";

export function WorkSurface({
  playerRef,
  onOpenTranscribe,
}: {
  playerRef: React.RefObject<PlayerRef | null>;
  onOpenTranscribe?: () => void;
}) {
  const activeTab = useStudioStore((s) => s.activeTab);
  const setTab = useStudioStore((s) => s.setTab);
  const video = useStudioStore((s) => s.video);
  const style = useStudioStore((s) => s.style);
  const setStyle = useStudioStore((s) => s.setStyle);
  const animation = useStudioStore((s) => s.animation);
  const setAnimation = useStudioStore((s) => s.setAnimation);
  const position = useStudioStore((s) => s.position);
  const setPosition = useStudioStore((s) => s.setPosition);
  const commit = useStudioStore((s) => s.commit);
  const lineCount = useStudioStore((s) => s.lines.length);

  const [pulsing, setPulsing] = useState(false);

  // commit() snapshots the CURRENT state, so it must run BEFORE the mutation
  // it is meant to undo. Committing after would record the post-change state
  // and undo would land a step short.
  //
  // Coalesce keys are per-field (`style:${key}`, `animation:${type}:${key}`)
  // so two different sliders touched within the coalesce window don't merge
  // into one undo step.
  const changeStyleField = <K extends keyof SubtitleStyle>(key: K, value: SubtitleStyle[K]) => {
    commit("Change style", { coalesceKey: `style:${String(key)}` });
    setStyle({ [key]: value } as Partial<SubtitleStyle>);
  };

  const changeAnimationType = (type: AnimationType) => {
    commit("Change animation");
    setAnimation({ type, options: defaultOptionsFor(type) } as AnimationConfig);
  };

  const changeAnimationOption = (fieldKey: string, options: AnimationConfig["options"]) => {
    commit("Change animation", { coalesceKey: `animation:${animation.type}:${fieldKey}` });
    setAnimation({ ...animation, options } as AnimationConfig);
  };

  const changePositionField = <K extends keyof SubtitlePosition>(
    key: K,
    value: SubtitlePosition[K],
  ) => {
    commit("Change position", { coalesceKey: `position:${String(key)}` });
    setPosition({ ...position, [key]: value });
  };

  const applyPreset = (preset: StylePreset) => {
    commit("Apply preset");
    setStyle(preset.style);
    setAnimation(preset.animation);
    setPulsing(true);
  };

  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => setTab(v as "lines" | "style")}
      className="flex min-h-0 min-w-0 flex-1 flex-col"
    >
      {/* Tabs and the line count stay put; only the panel below scrolls. */}
      <div className="mb-4 flex shrink-0 items-center justify-between">
        <TabsList>
          <TabsTrigger value="lines">Lines</TabsTrigger>
          <TabsTrigger value="style">Style</TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-2.5">
          {activeTab === "lines" && video?.file && (
            <button
              type="button"
              onClick={onOpenTranscribe}
              className="flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20 hover:text-emerald-300"
            >
              <Sparkles className="h-3 w-3" />
              Auto-transcribe
            </button>
          )}
          <span className="tabular text-xs text-ink-muted">{lineCount} lines</span>
        </div>
      </div>

      <TabsContent value="lines" className="min-h-0 flex-1 overflow-y-auto pr-1">
        <LineList playerRef={playerRef} onOpenTranscribe={onOpenTranscribe} />
      </TabsContent>

      <TabsContent
        value="style"
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1",
          pulsing && "animate-in fade-in duration-150 motion-reduce:animate-none",
        )}
        onAnimationEnd={() => setPulsing(false)}
      >
        <PresetPicker onApply={applyPreset} />
        <AnimationPanel
          animation={animation}
          onTypeChange={changeAnimationType}
          onOptionChange={changeAnimationOption}
        />
        <StylePanel
          style={style}
          onFieldChange={changeStyleField}
          position={position}
          onPositionFieldChange={changePositionField}
          animationType={animation.type}
        />
      </TabsContent>
    </Tabs>
  );
}
