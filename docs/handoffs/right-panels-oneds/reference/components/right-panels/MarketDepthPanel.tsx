import { useMemo } from "react";
import {
  KeyValueRows,
  MiniSpark,
  PanelBody,
  PanelFooter,
  PanelFrame,
  PanelHeader,
  PanelSection,
  Pill,
} from "./PanelKit";
import { useTickingPrice } from "./useTick";

/* 5 · Live data — market depth ladder.
 *
 * The only panel here that changes without being touched, which makes
 * stability the whole design problem. Three rules follow from it: the row
 * count never changes, so nothing reflows under the cursor; values update in
 * place and the price is the only element allowed to signal direction with
 * colour; and there is no action, because a button whose context repriced
 * itself between read and click is a trap.
 *
 * Motion is suppressed entirely under prefers-reduced-motion (see useTick) —
 * a ladder that never settles is unusable for some readers, and the numbers
 * are still correct when frozen.
 */

const LEVELS = 6;

export function MarketDepthPanel({ onClose }: { onClose?: () => void }) {
  const { price, direction, trail } = useTickingPrice(11842, {
    volatility: 0.0006,
    intervalMs: 1100,
  });

  // Depth is derived from the live mid so the ladder stays internally
  // consistent as it ticks, rather than two fixtures drifting apart.
  const book = useMemo(() => {
    const tick = 2;
    return Array.from({ length: LEVELS }, (_, i) => ({
      bidPx: price - tick * (i + 1),
      askPx: price + tick * (i + 1),
      bidSize: 1200 + ((i * 977) % 3400),
      askSize: 900 + ((i * 1319) % 3900),
      bidOrders: 3 + ((i * 5) % 9),
      askOrders: 2 + ((i * 7) % 11),
    }));
  }, [price]);

  const maxSize = Math.max(...book.flatMap((l) => [l.bidSize, l.askSize]));
  const spread = book[0].askPx - book[0].bidPx;
  const priceTone =
    direction === "up"
      ? "text-emerald-600"
      : direction === "down"
        ? "text-rose-600"
        : "text-neutral-900";

  return (
    <PanelFrame accent="info" label="Market depth">
      <PanelHeader
        eyebrow="Order book"
        title="AZN LN"
        subtitle="AstraZeneca · LSE · GBX"
        onClose={onClose}
        badge={
          <Pill tone="positive">
            <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            Live
          </Pill>
        }
      />

      <PanelBody>
        <PanelSection dense>
          <div className="flex items-end justify-between">
            <div>
              <div className={`text-2xl font-semibold tabular-nums ${priceTone}`}>
                {price.toFixed(0)}
              </div>
              <div className="text-[11px] text-emerald-600 tabular-nums">
                +110 (+0.94%)
              </div>
            </div>
            <MiniSpark points={trail} tone="positive" width={110} height={30} />
          </div>
        </PanelSection>

        {/* The ladder. Fixed height, fixed row count, no re-sorting. */}
        <PanelSection title="Depth" trailing={`Spread ${spread.toFixed(0)}`}>
          <div className="grid grid-cols-[1fr_auto_1fr] gap-x-2 text-[10px] font-semibold tracking-wider text-neutral-400 uppercase">
            <span>Bid</span>
            <span className="text-center">Px</span>
            <span className="text-right">Ask</span>
          </div>
          <ul className="mt-1.5 space-y-px">
            {book.map((l, i) => (
              <li
                key={i}
                className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-2 text-[11px] tabular-nums"
              >
                {/* Bid side — bar grows right-to-left, mirroring the book. */}
                <span className="relative flex h-5 items-center justify-end pr-1">
                  <span
                    aria-hidden
                    className="absolute inset-y-0 right-0 rounded-sm bg-emerald-50"
                    style={{ width: `${(l.bidSize / maxSize) * 100}%` }}
                  />
                  <span className="relative text-neutral-600">
                    {l.bidSize.toLocaleString()}
                  </span>
                </span>
                <span className="w-24 text-center">
                  <span className="text-emerald-700">{l.bidPx.toFixed(0)}</span>
                  <span className="mx-1 text-neutral-300">·</span>
                  <span className="text-rose-700">{l.askPx.toFixed(0)}</span>
                </span>
                <span className="relative flex h-5 items-center pl-1">
                  <span
                    aria-hidden
                    className="absolute inset-y-0 left-0 rounded-sm bg-rose-50"
                    style={{ width: `${(l.askSize / maxSize) * 100}%` }}
                  />
                  <span className="relative text-neutral-600">
                    {l.askSize.toLocaleString()}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex justify-between text-[10px] text-neutral-400 tabular-nums">
            <span>{book.reduce((s, l) => s + l.bidOrders, 0)} bid orders</span>
            <span>{book.reduce((s, l) => s + l.askOrders, 0)} ask orders</span>
          </div>
        </PanelSection>

        <PanelSection title="Session" last>
          <KeyValueRows
            rows={[
              { label: "Open", value: "11,732" },
              { label: "High / Low", value: "11,868 / 11,704" },
              { label: "VWAP", value: "11,801" },
              { label: "Volume", value: "1.42m" },
              { label: "ADV (20d)", value: "2.06m" },
              { label: "Book imbalance", value: "58% bid" },
            ]}
          />
        </PanelSection>
      </PanelBody>

      <PanelFooter note="Level 2 · delayed 15 min for display purposes">
        <span className="text-[11px] text-neutral-400">
          Read-only — route orders from the ticket.
        </span>
      </PanelFooter>
    </PanelFrame>
  );
}
