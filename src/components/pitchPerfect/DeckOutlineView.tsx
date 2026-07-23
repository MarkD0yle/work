import type { DeckSlide } from "../../lib/pitchPerfect/types";

export function DeckOutlineView({ slides }: { slides: DeckSlide[] }) {
  return (
    <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
      {slides.map((slide, i) => (
        <div key={i} className="px-5 py-4">
          <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">Slide {i + 1}</div>
          <h3 className="mt-0.5 text-sm font-semibold text-neutral-900">{slide.title}</h3>
          {slide.bullets.length === 0 ? (
            <p className="mt-1.5 text-xs text-neutral-400 italic">No content yet.</p>
          ) : (
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-neutral-800">
              {slide.bullets.map((b, j) => (
                <li key={j}>{b}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
