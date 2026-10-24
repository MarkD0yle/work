import { button, cx, focus, text } from "./tokens";
import type { StackItem } from "./usePanelStack";

/* PanelTrail — Back and the path above the current level, for a panel the
 * user drills through.
 *
 * Put it in ContextPanel's `actions` slot so it stays pinned while the body
 * scrolls. It lists only the levels *above* the current one: the panel title
 * already names where you are, and repeating it leaves no room in a narrow
 * panel. Back goes one level up; a crumb jumps further. With more than two
 * ancestors the middle collapses to "…" so the trail never wraps. State lives
 * in usePanelStack. */

const MAX_ANCESTORS = 2;

export function PanelTrail({
  trail,
  onBack,
  onJump,
}: {
  trail: StackItem[];
  onBack: () => void;
  onJump: (index: number) => void;
}) {
  const ancestors = trail.slice(0, -1).map((item, index) => ({ item, index }));
  const collapse = ancestors.length > MAX_ANCESTORS;
  // Keep the root and the direct parent; hide what is between.
  const shown = collapse ? [ancestors[0], ancestors[ancestors.length - 1]] : ancestors;
  const hidden = collapse ? ancestors.slice(1, -1).map((a) => a.item.title) : [];

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={onBack} disabled={ancestors.length === 0} aria-label="Back one level" className={cx(button.secondary, "shrink-0 px-2 py-1")}>
        ← Back
      </button>
      <nav aria-label="Panel path" className="min-w-0 flex-1">
        {ancestors.length === 0 ? (
          <span className={text.muted}>Top level</span>
        ) : (
          <ol className={cx("flex items-center gap-1", text.muted)}>
            {shown.map(({ item, index }, i) => (
              <li key={item.id} className="flex min-w-0 items-center gap-1">
                {i > 0 && <span aria-hidden>/</span>}
                {i === 1 && hidden.length > 0 && (
                  <>
                    <span title={hidden.join(" / ")} aria-label={`${hidden.length} hidden levels: ${hidden.join(", ")}`}>
                      …
                    </span>
                    <span aria-hidden>/</span>
                  </>
                )}
                <button type="button" onClick={() => onJump(index)} className={cx("truncate hover:text-neutral-900 hover:underline", focus)}>
                  {item.title}
                </button>
              </li>
            ))}
          </ol>
        )}
      </nav>
    </div>
  );
}
