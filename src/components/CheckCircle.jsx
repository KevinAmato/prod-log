// The core affordance of the whole app: a big, round, thumb-sized checkbox.
// The button's hit area is padded beyond the visible circle (44px minimum
// touch target) so marking things done never needs precision.
export default function CheckCircle({ checked, onToggle, size = 24, title }) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={checked}
      onClick={(e) => {
        e.stopPropagation();
        onToggle(e);
      }}
      className="-m-2 flex shrink-0 items-center justify-center p-2"
    >
      <span
        className={`flex items-center justify-center rounded-full border-2 transition-all duration-150 ${
          checked
            ? 'border-accent bg-accent text-white'
            : 'border-ink/25 bg-surface hover:border-accent/60'
        }`}
        style={{ width: size, height: size }}
      >
        <svg
          width={size * 0.55}
          height={size * 0.55}
          viewBox="0 0 12 12"
          className={`transition-opacity ${checked ? 'opacity-100' : 'opacity-0'}`}
        >
          <path
            d="M2 6.5 4.8 9 10 3.2"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </button>
  );
}
