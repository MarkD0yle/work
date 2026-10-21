import { useState, type ReactNode } from "react";
import CobrandTable from "./CobrandTable";
import OrderTypeTable from "./OrderTypeTable";
import { FIELD_BY_ID } from "../lib/schema";
import { formatDay, formatStamp, userName } from "../lib/engine";
import type { FundRecord2 } from "../lib/types";

/* Fund details — the read-only face of a record.
 *
 * Clicking a fund's long name in the register opens this instead of the
 * editor: most visits are "what are this fund's terms?", not "change them".
 * The layout follows the reference-data sheet ops already know — banded
 * sections of two-column label/value pairs, then the order-type table — with
 * the rough edges smoothed off:
 *   - empty values read "—", never a blank gap
 *   - identifiers are monospaced and copyable in one click
 *   - "last updated" sits behind a small clock on each value that has an
 *     audit entry, instead of a page-level "hover to view" instruction
 * Editing stays one explicit step away (the header's Edit button).
 */

const NOOP = () => {};

function lastWrite(record: FundRecord2, fieldId: string) {
  for (let i = record.audit.length - 1; i >= 0; i--) {
    if (record.audit[i].fieldId === fieldId) return record.audit[i];
  }
  return null;
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      }}
      aria-label={`Copy ${label}`}
      title={copied ? "Copied" : `Copy ${label}`}
      className="rounded p-0.5 text-neutral-400 opacity-0 group-hover:opacity-100 hover:text-neutral-900 focus:opacity-100"
    >
      {copied ? (
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden>
          <path
            fillRule="evenodd"
            d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.58l7.3-7.3a1 1 0 0 1 1.4 0Z"
            clipRule="evenodd"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden>
          <path d="M7 3.5A1.5 1.5 0 0 1 8.5 2h3.879a1.5 1.5 0 0 1 1.06.44l3.122 3.12A1.5 1.5 0 0 1 17 6.622V12.5a1.5 1.5 0 0 1-1.5 1.5h-1v-3.379a3 3 0 0 0-.879-2.121L10.5 5.379A3 3 0 0 0 8.379 4.5H7v-1Z" />
          <path d="M4.5 6A1.5 1.5 0 0 0 3 7.5v9A1.5 1.5 0 0 0 4.5 18h7a1.5 1.5 0 0 0 1.5-1.5v-5.879a1.5 1.5 0 0 0-.44-1.06L9.44 6.439A1.5 1.5 0 0 0 8.378 6H4.5Z" />
        </svg>
      )}
    </button>
  );
}

/** One label/value pair. `id` is the schema field the value comes from. */
function Item({
  record,
  id,
  label,
  mono,
  copy,
  render,
}: {
  record: FundRecord2;
  id: string;
  label?: string;
  mono?: boolean;
  copy?: boolean;
  render?: (v: string) => string;
}) {
  const raw = record.values[id] ?? "";
  const shown = raw ? (render ? render(raw) : raw) : "—";
  const name = label ?? FIELD_BY_ID[id]?.label ?? id;
  const write = lastWrite(record, id);
  return (
    <div className="group grid grid-cols-[minmax(9rem,40%)_1fr] items-baseline gap-3 py-1">
      <dt className="text-xs font-medium text-neutral-500">{name}</dt>
      <dd className="flex min-w-0 items-center gap-1.5 text-[13px] text-neutral-900">
        <span className={`truncate ${mono ? "font-mono text-xs" : ""} ${raw ? "" : "text-neutral-400"}`}>
          {shown}
        </span>
        {write && (
          <span
            className="shrink-0 cursor-help text-neutral-300 hover:text-neutral-600"
            title={`Last updated ${formatStamp(write.at)} by ${userName(write.actor)}${write.via === "import" ? " (import)" : ""}`}
            aria-label={`Last updated ${formatStamp(write.at)}`}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3" aria-hidden>
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .2.08.39.22.53l3 3a.75.75 0 1 0 1.06-1.06l-2.78-2.78V5Z"
                clipRule="evenodd"
              />
            </svg>
          </span>
        )}
        {copy && raw && <CopyButton value={raw} label={name} />}
      </dd>
    </div>
  );
}

function Band({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border border-neutral-200 bg-white">
      <h2 className="border-b border-neutral-200 bg-neutral-100 px-4 py-1.5 text-[11px] font-semibold tracking-[0.12em] text-neutral-600 uppercase">
        {title}
      </h2>
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}

function TwoCol({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <div className="grid gap-x-10 md:grid-cols-2">
      <dl>{left}</dl>
      <dl>{right}</dl>
    </div>
  );
}

const bps = (v: string) => `${v} bps`;
const day = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? formatDay(v) : v);

export default function FundDetails({ record }: { record: FundRecord2 }) {
  const lastAudit = record.audit[record.audit.length - 1];
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <Band title="Fund information">
        <TwoCol
          left={
            <>
              <Item record={record} id="provider" />
              <Item record={record} id="fundLongName" />
              <Item record={record} id="fundShortName" />
              <Item record={record} id="region" />
              <Item record={record} id="trust" />
              <Item record={record} id="domicile" label="Domicile country" />
              <Item record={record} id="mandateType" />
              <Item record={record} id="shareClass" />
              <Item record={record} id="baseCcy" />
            </>
          }
          right={
            <>
              <Item record={record} id="cutoff" label="Dealing cut-off" />
              <Item record={record} id="settlementMethod" />
              <Item record={record} id="settleCcy" />
              <Item record={record} id="tradeDate" render={day} />
              <Item record={record} id="settlementDate" render={day} />
              <Item record={record} id="mgmtFeeBps" render={bps} />
              <Item record={record} id="perfFeeBps" render={bps} />
              <Item record={record} id="dealingCharge" render={bps} />
              <Item record={record} id="riskCategory" />
            </>
          }
        />
      </Band>

      <Band title="Security identifiers">
        <TwoCol
          left={
            <>
              <Item record={record} id="instrumentId" label="ISIN" mono copy />
              <Item record={record} id="ticker" mono copy />
            </>
          }
          right={
            <>
              <Item record={record} id="fundCode" mono copy />
              <Item record={record} id="fundNumber" mono copy />
            </>
          }
        />
      </Band>

      <Band title="Counterparty & accounts">
        <TwoCol
          left={
            <>
              <Item record={record} id="cptyId" mono copy />
              <Item record={record} id="dealingAccount" mono copy />
            </>
          }
          right={
            <>
              <Item record={record} id="custodian" />
              <Item record={record} id="ssiBic" mono copy />
            </>
          }
        />
      </Band>

      <Band title="Fund distribution">
        <div className="-mx-4 -my-3">
          <CobrandTable value={record.values.cobrands ?? ""} readOnly onChange={NOOP} />
        </div>
      </Band>

      <Band title="ETF order types">
        <div className="-mx-4 -my-3">
          <OrderTypeTable
            values={record.values}
            readOnly
            ccy={record.values.baseCcy ?? ""}
            onChange={NOOP}
            fieldClass={() => ""}
            issueFor={() => null}
          />
        </div>
      </Band>

      <Band title="Record">
        <TwoCol
          left={
            <>
              <div className="grid grid-cols-[minmax(9rem,40%)_1fr] gap-3 py-1">
                <dt className="text-xs font-medium text-neutral-500">Created</dt>
                <dd className="text-[13px]">
                  {formatStamp(record.createdAt)} · {userName(record.createdBy)}
                </dd>
              </div>
              <div className="grid grid-cols-[minmax(9rem,40%)_1fr] gap-3 py-1">
                <dt className="text-xs font-medium text-neutral-500">Last updated</dt>
                <dd className="text-[13px]">
                  {formatStamp(record.updatedAt)}
                  {lastAudit ? ` · ${userName(lastAudit.actor)}` : ""}
                </dd>
              </div>
            </>
          }
          right={
            <>
              <div className="grid grid-cols-[minmax(9rem,40%)_1fr] gap-3 py-1">
                <dt className="text-xs font-medium text-neutral-500">Approved</dt>
                <dd className={`text-[13px] ${record.approvedAt ? "" : "text-neutral-400"}`}>
                  {record.approvedAt
                    ? `${formatStamp(record.approvedAt)} · ${userName(record.approvedBy)}`
                    : "—"}
                </dd>
              </div>
              <div className="grid grid-cols-[minmax(9rem,40%)_1fr] gap-3 py-1">
                <dt className="text-xs font-medium text-neutral-500">Effective date</dt>
                <dd className={`text-[13px] ${record.effectiveDate ? "" : "text-neutral-400"}`}>
                  {record.effectiveDate ? formatDay(record.effectiveDate) : "—"}
                </dd>
              </div>
            </>
          }
        />
        {record.values.comments && (
          <p className="mt-2 border-t border-neutral-100 pt-2 text-xs text-neutral-600">
            <span className="font-medium text-neutral-500">Submitter notes · </span>
            {record.values.comments}
          </p>
        )}
      </Band>
    </div>
  );
}
