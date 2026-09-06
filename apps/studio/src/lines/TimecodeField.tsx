import { useEffect, useRef, useState } from "react";
import { formatTimecode, parseTimecode } from "@/lib/timecode";

interface TimecodeFieldProps {
  value: number;
  onCommit: (seconds: number) => void;
  /** Accessible name, since a bare tabular timecode has no visible label. */
  label?: string;
}

/**
 * A tabular-mono timecode input. Commits on blur or Enter, never per
 * keystroke — so typing "1" then "12" doesn't fight a neighbour clamp
 * mid-entry (the clamping itself lives in the store action passed as
 * onCommit). An invalid parse reverts the field without committing.
 *
 * `draftRef` (not just the `draft` state) is what `commit` reads, and
 * `skipNextCommit` is checked at its top. Both exist for the same reason:
 * calling `e.currentTarget.blur()` fires the DOM blur event - and therefore
 * `onBlur={commit}` - SYNCHRONOUSLY, before React re-renders. A `commit`
 * that closed over the `draft` state variable would read its PRE-revert
 * value on Escape (silently committing the discarded text) and would
 * double-fire on Enter (which calls commit() then blurs, triggering it a
 * second time via the nested blur). Reading a ref sidesteps the stale
 * closure; the skip flag makes Escape's nested blur-triggered commit a
 * no-op instead of committing the value Escape is meant to discard.
 */
export function TimecodeField({ value, onCommit, label }: TimecodeFieldProps) {
  const [draft, setDraft] = useState(() => formatTimecode(value));
  const draftRef = useRef(draft);
  const skipNextCommit = useRef(false);

  const updateDraft = (v: string) => {
    setDraft(v);
    draftRef.current = v;
  };

  // Keep the field in sync when the store's value changes from elsewhere
  // (undo, a neighbour's retime clamping this line) while unfocused.
  useEffect(() => {
    updateDraft(formatTimecode(value));
  }, [value]);

  const commit = () => {
    if (skipNextCommit.current) {
      skipNextCommit.current = false;
      return;
    }
    const parsed = parseTimecode(draftRef.current);
    if (parsed === null) {
      updateDraft(formatTimecode(value));
      return;
    }
    onCommit(parsed);
  };

  return (
    <input
      value={draft}
      aria-label={label}
      onChange={(e) => updateDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur(); // triggers onBlur -> commit(), reading the latest draftRef
        }
        if (e.key === "Escape") {
          e.preventDefault();
          skipNextCommit.current = true;
          updateDraft(formatTimecode(value));
          e.currentTarget.blur(); // triggers onBlur -> commit(), but the flag above no-ops it
        }
      }}
      className="tabular w-16 rounded-sm bg-transparent text-xs text-ink-muted outline-none
                 focus-visible:text-ink"
    />
  );
}
