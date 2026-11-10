import { PageHeader } from "../components/patterns";
import { button, cx, focus, text } from "../components/patterns/tokens";
import { ScreenStage } from "../components/tools/ScreenStage";
import { usePageCatalogue, type CatalogueItem } from "../hooks/usePageCatalogue";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { navigateToPage } from "../lib/navigation";

export const title = "Side by Side";
export const section = "patterns";
export const fullWidth = true;

/* Side by Side — two screens next to each other.
 *
 * Prompting produces variants fast (two blotters, two onboarding flows) and
 * they are hard to judge one at a time. Each pane lays its screen out at
 * full desktop width and scales it to half size, so what you compare is the
 * real layout, not a squeezed one. */

// Screens that embed other screens cannot be embedded themselves.
const EXCLUDED = new Set(["side-by-side", "demo-reel"]);

function Pane({
  label,
  slug,
  options,
  onChange,
}: {
  label: string;
  slug: string;
  options: CatalogueItem[];
  onChange: (slug: string) => void;
}) {
  return (
    <section aria-label={`Screen ${label}`} className="flex min-w-0 flex-col border border-neutral-200 bg-white">
      <div className="flex items-center gap-2 border-b border-neutral-200 p-2">
        <span className="grid h-6 w-6 shrink-0 place-items-center bg-neutral-900 text-[11px] font-semibold text-white">
          {label}
        </span>
        <select
          aria-label={`Screen ${label}`}
          value={slug}
          onChange={(e) => onChange(e.target.value)}
          className={cx("min-w-0 flex-1 rounded-none border border-neutral-300 bg-white px-2 py-1 text-xs", focus)}
        >
          {options.map((item) => (
            <option key={item.slug} value={item.slug}>
              {item.title} · {item.sectionLabel}
            </option>
          ))}
        </select>
        <button type="button" className={button.ghost} onClick={() => navigateToPage(slug)}>
          Open
        </button>
      </div>
      {/* Half-scale viewport: 200% wide and a full screen tall, scaled by 0.5.
       * The scale also pins the screen's fixed elements inside the pane. */}
      <div className="relative h-[50vh] overflow-hidden bg-neutral-50">
        <div className="h-screen w-[200%] origin-top-left scale-50">
          <ScreenStage key={slug} slug={slug} />
        </div>
      </div>
    </section>
  );
}

export default function SideBySidePage() {
  const catalogue = usePageCatalogue();
  const options = catalogue.filter((item) => !EXCLUDED.has(item.slug));
  const [left, setLeft] = useLocalStorage("sideBySide.left", "fund-connect");
  const [right, setRight] = useLocalStorage("sideBySide.right", "fund-connect-2");

  return (
    <div className="h-screen overflow-y-auto bg-neutral-50">
      <PageHeader
        className="pl-32"
        eyebrow="Tools"
        title="Side by Side"
        description="Compare two screens at the same scale."
        actions={
          <button
            type="button"
            className={button.secondary}
            onClick={() => {
              setLeft(right);
              setRight(left);
            }}
          >
            Swap sides
          </button>
        }
      />
      <div className="grid gap-4 p-6 lg:grid-cols-2">
        <Pane label="A" slug={left} options={options} onChange={setLeft} />
        <Pane label="B" slug={right} options={options} onChange={setRight} />
      </div>
      <p className={cx("px-6 pb-6", text.muted)}>
        Each pane shows the screen at half size. Use Open to see one at full size.
      </p>
    </div>
  );
}
