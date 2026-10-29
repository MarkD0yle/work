import { useState } from "react";
import {
  Field,
  GhostButton,
  MetaGrid,
  PanelBody,
  PanelFooter,
  PanelFrame,
  PanelHeader,
  PanelSection,
  Pill,
  PrimaryButton,
} from "./PanelKit";
import { inputCls } from "./panel-tokens";
import { useTickingPrice } from "./useTick";

/* 1 · Transactional — FX order ticket.
 *
 * The panel exists to commit one irreversible action, which sets every other
 * decision here. Side is chosen first and colours the primary button, so the
 * trader can never be confused about which way they are about to go. The live
 * rate stays pinned above the form because it is the number the whole ticket
 * is about, and pre-trade checks sit immediately above the footer so they are
 * read on the way to the button rather than skipped on the way past it.
 */

type Side = "buy" | "sell";
type OrderType = "market" | "limit" | "stop";

const SOFT_LIMIT = 50_000_000;

export function OrderTicketPanel({ onClose }: { onClose?: () => void }) {
  const [side, setSide] = useState<Side>("buy");
  const [orderType, setOrderType] = useState<OrderType>("limit");
  const [notional, setNotional] = useState("25000000");
  const [limitPx, setLimitPx] = useState("1.0838");
  const [tif, setTif] = useState("GTC");
  const [submitted, setSubmitted] = useState(false);

  const { price, direction } = useTickingPrice(1.0842, { volatility: 0.0004 });
  const bid = price - 0.00008;
  const ask = price + 0.00008;
  const amount = Number(notional) || 0;
  const overSoftLimit = amount > SOFT_LIMIT;
  const counterValue = amount * (side === "buy" ? ask : bid);

  const rateTone =
    direction === "up"
      ? "text-emerald-600"
      : direction === "down"
        ? "text-rose-600"
        : "text-neutral-900";

  return (
    <PanelFrame accent={side === "buy" ? "positive" : "negative"} label="Order ticket">
      <PanelHeader
        eyebrow="New order"
        title="EUR/USD"
        subtitle="Spot · value date 19 Aug 26 · Desk FXG10"
        onClose={onClose}
        badge={<Pill tone="info">Staged</Pill>}
      />

      <PanelBody>
        {/* Live market — the anchor number, above the form that references it. */}
        <MetaGrid
          items={[
            { label: "Bid", value: bid.toFixed(5) },
            { label: "Ask", value: ask.toFixed(5) },
          ]}
        />
        <PanelSection dense>
          <div className="flex items-baseline justify-between">
            <span className="text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">
              Mid
            </span>
            <span className={`text-lg font-semibold tabular-nums ${rateTone}`}>
              {price.toFixed(5)}
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between text-[11px] text-neutral-500">
            <span>Spread 0.16 pips</span>
            <span className="tabular-nums">Prev close 1.0819</span>
          </div>
        </PanelSection>

        {/* Side — first decision, and the one the footer inherits. */}
        <PanelSection title="Side" dense>
          <div className="grid grid-cols-2 gap-2">
            {(["buy", "sell"] as Side[]).map((s) => {
              const on = side === s;
              const tone =
                s === "buy"
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                  : "border-rose-500 bg-rose-50 text-rose-700";
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSide(s)}
                  aria-pressed={on}
                  className={`rounded-md border px-3 py-2 text-sm font-semibold uppercase transition ${
                    on
                      ? tone
                      : "border-neutral-300 bg-white text-neutral-500 hover:bg-neutral-50"
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </PanelSection>

        <PanelSection title="Order">
          <div className="space-y-3">
            <Field
              label="Notional"
              hint={overSoftLimit ? "over soft limit" : "EUR"}
            >
              <input
                value={notional}
                onChange={(e) =>
                  setNotional(e.target.value.replace(/[^0-9]/g, ""))
                }
                inputMode="numeric"
                className={`${inputCls} ${overSoftLimit ? "border-amber-400" : ""}`}
              />
            </Field>

            <div className="grid grid-cols-2 gap-2">
              <Field label="Type">
                <select
                  value={orderType}
                  onChange={(e) => setOrderType(e.target.value as OrderType)}
                  className={inputCls}
                >
                  <option value="market">Market</option>
                  <option value="limit">Limit</option>
                  <option value="stop">Stop</option>
                </select>
              </Field>
              <Field label="TIF">
                <select
                  value={tif}
                  onChange={(e) => setTif(e.target.value)}
                  className={inputCls}
                >
                  <option>GTC</option>
                  <option>IOC</option>
                  <option>FOK</option>
                  <option>Day</option>
                </select>
              </Field>
            </div>

            {orderType !== "market" && (
              <Field
                label={orderType === "limit" ? "Limit price" : "Stop price"}
                hint={`${(((Number(limitPx) || 0) - price) * 10000).toFixed(1)} pips`}
              >
                <input
                  value={limitPx}
                  onChange={(e) => setLimitPx(e.target.value)}
                  inputMode="decimal"
                  className={inputCls}
                />
              </Field>
            )}

            <Field label="Account">
              <select className={inputCls} defaultValue="FXG10-PRIN">
                <option value="FXG10-PRIN">FXG10-PRIN · Principal</option>
                <option value="FXG10-AGCY">FXG10-AGCY · Agency</option>
              </select>
            </Field>
          </div>
        </PanelSection>

        {/* Pre-trade checks — last thing before the button, deliberately. */}
        <PanelSection title="Pre-trade checks" last>
          <ul className="space-y-1.5">
            <CheckRow ok label="Credit line" detail="Utilisation 41% post-trade" />
            <CheckRow ok label="Best execution" detail="Within tolerance band" />
            <CheckRow
              ok={!overSoftLimit}
              label="Desk soft limit"
              detail={
                overSoftLimit
                  ? "Above EUR 50m — supervisor sign-off required"
                  : "Within EUR 50m"
              }
            />
          </ul>
        </PanelSection>
      </PanelBody>

      <PanelFooter
        note={
          submitted ? (
            <span className="font-medium text-emerald-700">
              Order routed to EBS · ack 08:41:22
            </span>
          ) : (
            <span className="flex justify-between tabular-nums">
              <span>Counter value</span>
              <span className="font-medium text-neutral-900">
                {counterValue.toLocaleString("en-GB", {
                  maximumFractionDigits: 0,
                })}{" "}
                USD
              </span>
            </span>
          )
        }
      >
        <PrimaryButton
          tone={side === "buy" ? "positive" : "negative"}
          onClick={() => setSubmitted(true)}
          disabled={amount <= 0}
        >
          {side === "buy" ? "Buy" : "Sell"} EUR{" "}
          {amount >= 1_000_000 ? `${(amount / 1_000_000).toFixed(1)}m` : amount}
        </PrimaryButton>
        <GhostButton onClick={onClose}>Cancel</GhostButton>
      </PanelFooter>
    </PanelFrame>
  );
}

function CheckRow({
  ok,
  label,
  detail,
}: {
  ok: boolean;
  label: string;
  detail: string;
}) {
  return (
    <li className="flex items-start gap-2">
      <span
        aria-hidden
        className={`mt-1 inline-flex h-1.5 w-1.5 shrink-0 rounded-full ${
          ok ? "bg-emerald-500" : "bg-amber-500"
        }`}
      />
      <span className="min-w-0">
        <span className="block text-xs font-medium text-neutral-900">{label}</span>
        <span className="block text-[11px] text-neutral-500">{detail}</span>
      </span>
    </li>
  );
}
