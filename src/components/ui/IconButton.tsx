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
      className={`grid size-11 place-items-center rounded-full border border-stone-200 bg-white text-stone-800 shadow-sm transition hover:border-stone-300 hover:bg-stone-50 ${className}`}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}
