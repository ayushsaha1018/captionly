/** The spotting ruler: a vertical mark whose weight encodes row state. */
export function RulerGutter({ selected }: { selected: boolean }) {
  return (
    <div
      aria-hidden
      className={`shrink-0 rounded-full transition-colors ${
        selected ? "w-[3px] bg-edit" : "w-px bg-hairline"
      }`}
    />
  );
}
