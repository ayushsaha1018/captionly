import { useEffect, useState } from "react";
import { formatTimecode, parseTimecode } from "@/lib/timecode";

interface TimecodeFieldProps {
  value: number;
  onCommit: (seconds: number) => void;
  label?: string;
}

/**
 * A tabular-mono timecode input. Commits on blur or Enter, never per
 * keystroke — so typing "1" then "12" doesn't fight a neighbour clamp
 * mid-entry (the clamping itself lives in the store action passed as
 * onCommit). An invalid parse reverts the field without committing.
 */
export function TimecodeField({ value, onCommit, label }: TimecodeFieldProps) {
  const [draft, setDraft] = useState(() => formatTimecode(value));

  // Keep the field in sync when the store's value changes from elsewhere
  // (undo, a neighbour's retime clamping this line) while unfocused.
  useEffect(() => {
    setDraft(formatTimecode(value));
  }, [value]);

  const commit = () => {
    const parsed = parseTimecode(draft);
    if (parsed === null) {
      setDraft(formatTimecode(value));
      return;
    }
    onCommit(parsed);
  };

  return (
    <input
      value={draft}
      aria-label={label}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
          e.currentTarget.blur();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setDraft(formatTimecode(value));
          e.currentTarget.blur();
        }
      }}
      className="tabular w-16 rounded-sm bg-transparent text-xs text-ink-muted outline-none
                 focus-visible:text-ink"
    />
  );
}
