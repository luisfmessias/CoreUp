export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <svg aria-hidden="true" height={size} viewBox="0 0 64 64" width={size}>
      <path d="M42 22.5a13 13 0 1 0 0 19" fill="none" stroke="var(--color-accent)" strokeLinecap="round" strokeWidth="7" />
      <circle cx="44" cy="32" fill="var(--color-accent)" r="3.5" />
    </svg>
  );
}
