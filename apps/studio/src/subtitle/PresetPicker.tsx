import { PRESETS, type StylePreset } from "@captionly/engine";
import { Button } from "@/components/ui/button";

export function PresetPicker({ onApply }: { onApply: (preset: StylePreset) => void }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-lg h-fit">
      <h2 className="text-sm font-semibold text-card-foreground">Presets</h2>
      <div className="flex flex-wrap gap-2">
        {Object.entries(PRESETS).map(([key, preset]) => (
          <Button key={key} variant="outline" size="sm" onClick={() => onApply(preset)}>
            {preset.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
