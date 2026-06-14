// Tiny shared primitives. Minimalist by design — the product is the funnel
// logic and the evidence ledger, not a heavy component kit.

export function Button({ variant = 'primary', className = '', ...props }) {
  const base =
    'inline-flex items-center justify-center rounded-md px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
  const variants = {
    primary: 'bg-ink text-paper hover:bg-ink/90',
    accent: 'bg-accent text-white hover:bg-accent/90',
    ghost: 'text-ink/70 hover:bg-ink/5',
    outline: 'border border-ink/20 text-ink hover:bg-ink/5',
    danger: 'text-accent hover:bg-accent/10',
  };
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink/80">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink/50">{hint}</span>}
    </label>
  );
}

export const inputClass =
  'w-full rounded-md border border-ink/20 bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent';

export function Card({ className = '', ...props }) {
  return (
    <div
      className={`rounded-lg border border-ink/10 bg-white/70 ${className}`}
      {...props}
    />
  );
}

export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded bg-ink/10 ${className}`} />;
}

export function Pill({ children, tone = 'neutral' }) {
  const tones = {
    neutral: 'bg-ink/5 text-ink/70',
    flag: 'bg-accent/10 text-accent',
    warn: 'bg-amber-500/15 text-amber-700',
    good: 'bg-emerald-600/10 text-emerald-700',
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${tones[tone]}`}>
      {children}
    </span>
  );
}
