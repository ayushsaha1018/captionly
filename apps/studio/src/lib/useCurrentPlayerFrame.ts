import type { CallbackListener, PlayerRef } from "@remotion/player";
import { useCallback, useSyncExternalStore } from "react";

/**
 * Subscribes to the player's current frame.
 *
 * Call this in ONE leaf component only (Playhead). It fires on every frame;
 * calling it higher in the tree re-renders the whole editor at fps.
 * The frame must never be written into the zustand store — see spec §6.2.1.
 */
export function useCurrentPlayerFrame(
  ref: React.RefObject<PlayerRef | null>,
): number {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const { current } = ref;
      if (!current) return () => undefined;

      const updater: CallbackListener<"frameupdate"> = () => onStoreChange();
      current.addEventListener("frameupdate", updater);
      return () => current.removeEventListener("frameupdate", updater);
    },
    [ref],
  );

  return useSyncExternalStore<number>(
    subscribe,
    () => ref.current?.getCurrentFrame() ?? 0,
    () => 0,
  );
}
