/* NewBadge — small emerald pill marking a recently added page. */

export default function NewBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm ${className}`}
    >
      <span className="h-1 w-1 rounded-full bg-white" />
      New
    </span>
  );
}
