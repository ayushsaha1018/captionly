import type { PlayerRef } from "@remotion/player";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useStudioStore } from "@/store";
import { StylePanel } from "@/subtitle/StylePanel";
import { AnimationPanel } from "@/subtitle/AnimationPanel";
import { LineList } from "@/lines/LineList";
import type { SafeZonePreset, SubtitleStyle, AnimationConfig } from "@captionly/engine";

export function WorkSurface({
  playerRef,
  safeZone,
  onSafeZoneChange,
}: {
  playerRef: React.RefObject<PlayerRef | null>;
  safeZone: SafeZonePreset;
  onSafeZoneChange: (z: SafeZonePreset) => void;
}) {
  const activeTab = useStudioStore((s) => s.activeTab);
  const setTab = useStudioStore((s) => s.setTab);
  const style = useStudioStore((s) => s.style);
  const setStyle = useStudioStore((s) => s.setStyle);
  const animation = useStudioStore((s) => s.animation);
  const setAnimation = useStudioStore((s) => s.setAnimation);
  const commit = useStudioStore((s) => s.commit);
  const lineCount = useStudioStore((s) => s.lines.length);

  // commit() snapshots the CURRENT state, so it must run BEFORE the mutation
  // it is meant to undo. Committing after would record the post-change state
  // and undo would land a step short.
  //
  // Both carry a coalesceKey: a slider drag fires dozens of changes, and
  // without one each would become its own undo entry.
  const changeStyle = (next: SubtitleStyle) => {
    commit("Change style", { coalesceKey: "style" });
    setStyle(next);
  };

  const changeAnimation = (next: AnimationConfig) => {
    commit("Change animation", { coalesceKey: "animation" });
    setAnimation(next);
  };

  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => setTab(v as "lines" | "style")}
      className="min-w-0 flex-1"
    >
      <div className="mb-4 flex items-center justify-between">
        <TabsList>
          <TabsTrigger value="lines">Lines</TabsTrigger>
          <TabsTrigger value="style">Style</TabsTrigger>
        </TabsList>
        <span className="tabular text-xs text-ink-muted">{lineCount} lines</span>
      </div>

      <TabsContent value="lines">
        <LineList playerRef={playerRef} />
      </TabsContent>

      <TabsContent value="style" className="flex flex-col gap-4">
        <AnimationPanel animation={animation} onChange={changeAnimation} />
        <StylePanel
          style={style}
          onStyleChange={changeStyle}
          safeZone={safeZone}
          onSafeZoneChange={onSafeZoneChange}
        />
      </TabsContent>
    </Tabs>
  );
}
