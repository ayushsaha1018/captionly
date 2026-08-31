/** The spotting ruler: a vertical mark whose weight encodes row state. */
export function RulerGutter({ selected }: { selected: boolean }) {
  return (
    <div
      aria-hidden
      className={`w-px shrink-0 rounded-full transition-colors ${
        selected ? "w-[3px] bg-edit" : "bg-hairline"
      }`}
    />
  );
}
