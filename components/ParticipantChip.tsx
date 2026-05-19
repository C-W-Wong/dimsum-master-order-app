import type { Participant } from "@/lib/room";

export function ParticipantChip({
  p,
  size = "md",
  showName = true,
  highlight = false,
}: {
  p: Participant;
  size?: "sm" | "md";
  showName?: boolean;
  highlight?: boolean;
}) {
  const initials = p.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";
  const dim = size === "sm" ? "h-6 w-6 text-[10px]" : "h-7 w-7 text-[11px]";
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-full pl-0.5 pr-2.5 " +
        (highlight ? "ring-2 ring-offset-1 ring-offset-paper " : "")
      }
      style={highlight ? { boxShadow: `0 0 0 2px hsl(${p.hue} 70% 45%)` } : undefined}
    >
      <span
        className={`flex ${dim} items-center justify-center rounded-full font-bold text-white`}
        style={{ background: `hsl(${p.hue} 65% 42%)` }}
        aria-hidden
      >
        {initials}
      </span>
      {showName && (
        <span
          className={size === "sm" ? "text-xs font-medium" : "text-sm font-medium"}
        >
          {p.name}
        </span>
      )}
    </span>
  );
}
