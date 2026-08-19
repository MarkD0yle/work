/* Icon — 24px outline glyphs shared by both App Home layouts.
 *
 * Outline rather than solid: at 20px inside a tinted tile the lighter stroke
 * keeps nine icons in a row from turning into a block of colour. */

export function Icon({
  path,
  className,
}: {
  path: string;
  className?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d={path} />
    </svg>
  );
}
