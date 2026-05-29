import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from "react";
import { SEVERITY_TONES, type Severity } from "../../lib/severity-tokens";

/* Modal — centered, focus-trapped dialog.
 *
 * Deliberately distinct from the two existing overlays:
 *   - FileForensicSheet  bottom sheet, click-through backdrop, for browsing
 *   - PipelineDrawer     docked side region, persistent, for deep context
 *   - Modal (this)       centered, traps focus + interaction, for a single
 *                        focused decision or short form
 *
 * Severity tints the top accent bar only — hue carries severity, never the
 * whole surface (spec §11). Esc and backdrop click both close; focus is
 * captured on open and restored to the opener on close.
 */

// Max-width in px, applied inline so the component doesn't depend on the
// host app having generated a particular max-w-* utility (matches Tailwind's
// container-sm / -md / -xl scale: 24 / 28 / 36 rem).
const SIZES = {
  sm: 384,
  md: 448,
  lg: 576,
} as const;

export default function Modal({
  open,
  onClose,
  title,
  description,
  severity,
  size = "md",
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  severity?: Severity;
  size?: keyof typeof SIZES;
  footer?: ReactNode;
  children?: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();

  // Close on Esc + simple focus trap. Restore focus to the opener on unmount.
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = panel.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    // Focus the first focusable element inside the panel.
    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current;
      panel
        ?.querySelector<HTMLElement>(
          'button:not([disabled]),input:not([disabled]),textarea:not([disabled]),a[href]',
        )
        ?.focus();
    });

    return () => {
      document.removeEventListener("keydown", onKey);
      cancelAnimationFrame(raf);
      opener?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  const accent = severity ? SEVERITY_TONES[severity].surface.bg : "bg-neutral-900";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop — true modal: traps interaction, click closes. */}
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-neutral-900/40"
      />

      <div
        ref={panelRef}
        style={{ maxWidth: SIZES[size], maxHeight: "85vh" }}
        className="relative flex w-full animate-[forensic-slide-up_240ms_ease-out] flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-2xl"
      >
        <span aria-hidden className={`h-1 w-full shrink-0 ${accent}`} />

        <header className="flex items-start gap-3 border-b border-neutral-200 px-5 pt-4 pb-3">
          <div className="min-w-0 flex-1">
            <h2
              id={titleId}
              className="text-base font-semibold tracking-tight text-neutral-900"
            >
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1 text-xs text-neutral-500">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="-mr-1 rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path
                fillRule="evenodd"
                d="M4.28 4.28a.75.75 0 0 1 1.06 0L10 8.94l4.66-4.66a.75.75 0 1 1 1.06 1.06L11.06 10l4.66 4.66a.75.75 0 1 1-1.06 1.06L10 11.06l-4.66 4.66a.75.75 0 1 1-1.06-1.06L8.94 10 4.28 5.34a.75.75 0 0 1 0-1.06Z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </header>

        {children && (
          <div className="flex-1 overflow-y-auto px-5 py-4 text-sm text-neutral-700">
            {children}
          </div>
        )}

        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t border-neutral-200 bg-neutral-50 px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

/* ConfirmDialog — the common case: a yes/no decision built on Modal.
 *
 * `destructive` swaps the confirm button to the benchmark (red) tone and
 * tints the accent bar, signalling an irreversible action. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      severity={destructive ? "benchmark" : undefined}
      size="sm"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-40"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 ${
              destructive
                ? "bg-red-600 hover:bg-red-700"
                : "bg-neutral-900 hover:bg-neutral-800"
            }`}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </>
      }
    />
  );
}
