import * as React from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { clampToStep, decimalsFromStep } from "@/lib/numberField";

// Figma/Blender-style scrubbable number input: click-drag horizontally to
// scrub the value, click (no drag) to type an exact one, or use the stepper
// buttons / arrow keys. Replaces a slider + its label's inline "(84px)" text
// with one compact control.

const DRAG_THRESHOLD_PX = 3;
const PIXELS_PER_STEP = 4;

export interface NumberFieldProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  className?: string;
  "aria-label"?: string;
}

export const NumberField = React.forwardRef<HTMLInputElement, NumberFieldProps>(
  (
    { value, onChange, min, max, step = 1, suffix = "", className, "aria-label": ariaLabel },
    forwardedRef,
  ) => {
    const inputRef = React.useRef<HTMLInputElement | null>(null);
    React.useImperativeHandle(forwardedRef, () => inputRef.current as HTMLInputElement);

    const [editing, setEditing] = React.useState(false);
    const [draftText, setDraftText] = React.useState("");
    const dragState = React.useRef<{
      startX: number;
      startValue: number;
      dragging: boolean;
    } | null>(null);

    const decimals = decimalsFromStep(step);
    const displayValue = `${value.toFixed(decimals)}${suffix}`;

    const commit = (next: number) => {
      const clamped = clampToStep(next, min, max, step);
      onChange(clamped);
      // Keep the displayed draft in sync — while editing, the input renders
      // draftText, not the live value, so a commit that doesn't update it
      // would look like a no-op until blur re-parses (and clobbers) the
      // stale draft.
      if (editing) setDraftText(clamped.toFixed(decimals));
    };

    const beginEdit = () => {
      setDraftText(value.toFixed(decimals));
      setEditing(true);
    };

    const commitEdit = () => {
      // A drag focuses the input as a side effect (pointerdown default) without
      // ever entering typed-edit mode — ignore blur in that case, or it commits
      // stale draftText and clobbers the value the drag just set.
      if (!editing) return;
      const parsed = parseFloat(draftText);
      if (!Number.isNaN(parsed)) commit(parsed);
      setEditing(false);
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLInputElement>) => {
      if (editing) return; // already typing — let normal caret placement happen
      dragState.current = { startX: e.clientX, startValue: value, dragging: false };
      e.currentTarget.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLInputElement>) => {
      const state = dragState.current;
      if (!state) return;
      const deltaX = e.clientX - state.startX;

      if (!state.dragging) {
        if (Math.abs(deltaX) < DRAG_THRESHOLD_PX) return;
        state.dragging = true;
      }

      e.preventDefault();
      const speed = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
      const delta = (deltaX / PIXELS_PER_STEP) * step * speed;
      commit(state.startValue + delta);
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLInputElement>) => {
      const state = dragState.current;
      e.currentTarget.releasePointerCapture(e.pointerId);
      dragState.current = null;
      if (state && !state.dragging) {
        // A click without movement focuses for typing, same as a plain input.
        beginEdit();
      } else if (state?.dragging) {
        // Drop the focus the browser gave the input on pointerdown — the drag
        // already committed the value, this input was never in edit mode.
        e.currentTarget.blur();
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.currentTarget.blur();
      } else if (e.key === "Escape") {
        setEditing(false);
        e.currentTarget.blur();
      } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        const delta = (e.key === "ArrowUp" ? 1 : -1) * step * (e.shiftKey ? 10 : 1);
        commit(value + delta);
      }
    };

    return (
      <div
        className={cn(
          "flex h-9 items-center rounded-md border border-input bg-transparent shadow-sm transition-colors focus-within:ring-1 focus-within:ring-ring",
          className,
        )}
      >
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          aria-label={ariaLabel}
          value={editing ? draftText : displayValue}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setDraftText(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          className={cn(
            "h-full w-full min-w-0 rounded-l-md bg-transparent px-2 text-sm text-foreground outline-none",
            editing ? "cursor-text" : "cursor-ew-resize select-none",
          )}
        />
        <div className="flex h-full flex-col border-l border-input">
          <button
            type="button"
            tabIndex={-1}
            aria-label="Increase"
            onClick={() => commit(value + step)}
            className="flex flex-1 items-center justify-center px-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <ChevronUp className="h-3 w-3" />
          </button>
          <button
            type="button"
            tabIndex={-1}
            aria-label="Decrease"
            onClick={() => commit(value - step)}
            className="flex flex-1 items-center justify-center border-t border-input px-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  },
);
NumberField.displayName = "NumberField";
