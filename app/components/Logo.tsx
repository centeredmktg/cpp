type LogoProps = {
  /**
   * 'light' renders the artwork in white (for dark backgrounds).
   * 'dark' renders the original black artwork (for white/light backgrounds).
   */
  variant?: 'light' | 'dark'
  /** Rendered height in px. Width scales to preserve the square badge proportions. */
  height?: number
  className?: string
}

// Single black master at /cpp-logo.png. The white variant is produced with
// `brightness(0) invert(1)` — crush to pure black (keeping alpha), then flip to
// pure #fff — so there's no second asset to keep in sync.
export default function Logo({ variant = 'light', height = 75, className = '' }: LogoProps) {
  return (
    <img
      src="/cpp-logo.png"
      alt="CPP Painting & Construction"
      width={height}
      height={height}
      className={className}
      style={{
        height,
        width: 'auto',
        filter: variant === 'light' ? 'brightness(0) invert(1)' : 'none',
      }}
    />
  )
}
