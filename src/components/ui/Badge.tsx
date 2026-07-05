import type { ReactNode } from "react";

type BadgeProps = {
  children: ReactNode;
  tone?: "dark" | "green" | "blue" | "muted";
};

const tones = {
  dark: "bg-stone-950 text-white",
  green: "bg-emerald-100 text-emerald-900",
  blue: "bg-sky-100 text-sky-900",
  muted: "bg-stone-100 text-stone-700"
};

export function Badge({ children, tone = "muted" }: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}
