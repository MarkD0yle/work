import type { FileEvidence } from "../../lib/file-forensic-data";

/* Spec v0.1.2 L4 §4.1 + Appendix B — labelled key-value narrative.
 *
 * Reads faster than a wide grid when investigating, and screen readers
 * handle labelled pairs better than 11-column tables. */

export default function ForensicNarrative({
  evidence,
}: {
  evidence: FileEvidence;
}) {
  return (
    <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1.5 font-mono text-[11px] text-neutral-800">
      <Row label="PATH">
        <span className="break-all">{evidence.filepath}</span>
      </Row>
      <Row label="EMAIL">
        <div className="flex flex-col gap-0.5">
          <span>"{evidence.emailSubject}"</span>
          <span className="text-neutral-500">From: {evidence.emailFrom}</span>
          <span className="text-neutral-500">
            Expected by: {evidence.due} ET
          </span>
        </div>
      </Row>
      <Row label="FILE ID">{evidence.fileId}</Row>
      <Row label="SUBJECT">{evidence.fileSubject}</Row>
      <Row label="FOLDER">{evidence.stFolder}</Row>
      <Row label="RECEIVED">
        {evidence.filenameReceived ?? (
          <span className="text-neutral-400">— not received</span>
        )}
      </Row>
      <Row label="LAST POLL">
        {evidence.lastCheck} · {evidence.lastCheckAgeMin}m ago ·{" "}
        {evidence.filenameReceived ? "matched" : "returned 0 matches"}
      </Row>
    </dl>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <dt className="text-[10px] font-sans font-semibold tracking-widest text-neutral-500 uppercase">
        {label}
      </dt>
      <dd className="break-words">{children}</dd>
    </>
  );
}
