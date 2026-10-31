import type { ButtonHTMLAttributes, ReactNode } from "react";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  children: ReactNode;
};

export function IconButton({ label, children, className = "", ...props }: IconButtonProps) {
  return (
    <button
      aria-label={label}
      title={label}
      className={`grid size-10 place-items-center rounded-full bg-white/[0.05] text-white/75 transition hover:bg-white/10 hover:text-white active:scale-95 ${className}`}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}
