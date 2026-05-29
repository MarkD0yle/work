import { useEffect, useState } from "react";
import MonitorGrid from "../components/patterns/MonitorGrid";
import ContextPanel, {
  PanelSection,
  PanelMetaGrid,
} from "../components/patterns/ContextPanel";
import Modal, { ConfirmDialog } from "../components/patterns/Modal";
import { fetchMonitors, type QlikMonitor } from "../lib/qlik";
import {
  monitorStatusToSeverity,
  type Severity,
} from "../lib/severity-tokens";

export const title = "Pattern Gallery";
export const fullWidth = true;

/* Pattern Gallery — a live harness for the reusable UI patterns added on
 * this branch (Modal, MonitorGrid, ContextPanel). It wires them together as
 * an operator would actually use them: triage a grid, open a row in the
 * context panel, take an action through a modal. Real fixture data flows
 * through so the severity treatment is exercised end to end. */

function severityFor(m: QlikMonitor): Severity {
  return monitorStatusToSeverity(m.status);
}

export default function PatternGalleryPage() {
  const [monitors, setMonitors] = useState<QlikMonitor[]>([]);
  const [selected, setSelected] = useState<QlikMonitor | null>(null);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    let live = true;
    fetchMonitors("at-risk").then((m) => {
      if (live) setMonitors(m);
    });
    return () => {
      live = false;
    };
  }, []);

  function resolveSelected() {
    setResolving(true);
    setTimeout(() => {
      setMonitors((prev) =>
        prev.map((m) =>
          m.id === selected?.id
            ? { ...m, status: "green", detail: "Resolved from gallery" }
            : m,
        ),
      );
      setResolving(false);
      setResolveOpen(false);
      setSelected(null);
    }, 500);
  }

  return (
    <div className="flex h-full flex-col bg-neutral-50">
      {/* Page header */}
      <header className="flex items-end justify-between border-b border-neutral-200 bg-white px-6 py-4">
        <div>
          <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
            UI patterns
          </div>
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-neutral-900">
            Pattern Gallery
          </h1>
          <p className="mt-0.5 text-xs text-neutral-500">
            ag-grid data table · docked context panel · centered modal — all on
            the shared severity tokens.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setInfoOpen(true)}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
        >
          About these patterns
        </button>
      </header>

      {/* Split: grid + context panel */}
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 p-4">
          <div className="h-full overflow-hidden rounded-lg border border-neutral-200 bg-white">
            <MonitorGrid
              monitors={monitors}
              onRowClick={(m) => setSelected(m)}
            />
          </div>
        </div>

        {selected && (
          <div className="shrink-0" style={{ width: 360 }}>
            <ContextPanel
              title={selected.name}
              eyebrow={`${selected.category} monitor`}
              severity={severityFor(selected)}
              onClose={() => setSelected(null)}
              actions={
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setResolveOpen(true)}
                    disabled={selected.status === "green"}
                    className="flex-1 rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:bg-neutral-300"
                  >
                    Resolve monitor
                  </button>
                  <button
                    type="button"
                    onClick={() => setInfoOpen(true)}
                    className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
                  >
                    Details
                  </button>
                </div>
              }
            >
              <PanelMetaGrid
                items={[
                  {
                    label: "Status",
                    value: <span className="capitalize">{selected.status}</span>,
                  },
                  { label: "Affected", value: selected.affectedCount },
                  {
                    label: "Tier",
                    value: (
                      <span className="capitalize">{selected.tier ?? "—"}</span>
                    ),
                  },
                  {
                    label: "Kind",
                    value: (
                      <span className="capitalize">
                        {(selected.kind ?? "alert").replace("_", " ")}
                      </span>
                    ),
                  },
                ]}
              />
              <PanelSection title="Detail">
                <p className="text-sm text-neutral-700">{selected.detail}</p>
              </PanelSection>
              <PanelSection title="Last refresh" last>
                <p className="font-mono text-xs text-neutral-600">
                  {new Date(selected.lastRefresh).toLocaleString("en-GB")}
                </p>
              </PanelSection>
            </ContextPanel>
          </div>
        )}
      </div>

      {/* Confirm action — destructive tone if escalated, plain otherwise */}
      <ConfirmDialog
        open={resolveOpen}
        onClose={() => setResolveOpen(false)}
        onConfirm={resolveSelected}
        title={`Resolve ${selected?.name ?? "monitor"}?`}
        description="This marks the monitor green and clears its detail. In the real app this writes an audited resolve action."
        confirmLabel="Resolve"
        destructive={selected?.status === "red"}
        busy={resolving}
      />

      {/* Plain informational modal */}
      <Modal
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        title="About these patterns"
        description="Three reusable shells, one severity language."
        size="lg"
        footer={
          <button
            type="button"
            onClick={() => setInfoOpen(false)}
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800"
          >
            Got it
          </button>
        }
      >
        <ul className="flex list-disc flex-col gap-2 pl-4">
          <li>
            <span className="font-semibold text-neutral-900">MonitorGrid</span>{" "}
            — ag-grid under a neutral house theme, severity pills from the
            shared tokens. For long, uniform lists that need sort / filter.
          </li>
          <li>
            <span className="font-semibold text-neutral-900">ContextPanel</span>{" "}
            — docked region with a severity-tinted edge, sticky action bar, and
            composable sections. For deep context beside the data.
          </li>
          <li>
            <span className="font-semibold text-neutral-900">Modal</span> — a
            true focus-trapped dialog with a ConfirmDialog variant. For a single
            decision; destructive actions pick up the red accent.
          </li>
        </ul>
      </Modal>
    </div>
  );
}
