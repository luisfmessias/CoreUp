import type { ReactNode } from "react";

type BadgeProps = {
  children: ReactNode;
  tone?: "dark" | "green" | "blue" | "muted";
};

const tones = {
  dark: "border-white/15 text-white/85",
  green: "border-accent/35 bg-accent/10 text-accent",
  blue: "border-white/10 text-white/60",
  muted: "border-white/10 text-white/60"
};

export function Badge({ children, tone = "muted" }: BadgeProps) {
  return (
    <span className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}
