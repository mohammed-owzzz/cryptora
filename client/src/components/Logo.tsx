import { Link } from 'react-router-dom';

/** Official brand artwork, derived from the supplied master files. */
const LOCKUP = '/brand/cryptora-logo.png';
const SYMBOL = '/brand/cryptora-symbol.png';

/** Intrinsic aspect ratios, used so the artwork is never distorted. */
const LOCKUP_RATIO = 800 / 164;
const SYMBOL_RATIO = 445 / 512;

export function LogoMark({ size = 34, className = '' }: { size?: number; className?: string }) {
  return (
    <img
      src={SYMBOL}
      alt=""
      aria-hidden="true"
      width={Math.round(size * SYMBOL_RATIO)}
      height={size}
      style={{ height: size }}
      decoding="async"
      className={`w-auto shrink-0 select-none ${className}`}
    />
  );
}

export function Logo({ to = '/', compact = false }: { to?: string; compact?: boolean }) {
  const height = compact ? 22 : 26;
  return (
    <Link to={to} className="inline-flex items-center">
      <img
        src={LOCKUP}
        alt="CRYPTORA"
        width={Math.round(height * LOCKUP_RATIO)}
        height={height}
        style={{ height }}
        decoding="async"
        className="w-auto select-none"
      />
    </Link>
  );
}
