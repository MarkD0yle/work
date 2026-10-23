/* eslint-disable react-refresh/only-export-components -- hooks/contexts live beside their components; HMR granularity is not a concern here */
import {
  cloneElement, isValidElement, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState,
  type ReactElement, type ReactNode, type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useEa } from "./context";
import { Button } from "./Button";

function usePortal(node: ReactNode) {
  const { portal } = useEa();
  return portal ? createPortal(node, portal) : null;
}

/* ---------- Tooltip ---------- */
export function Tip({ label, children, delay = 300 }: { label: ReactNode; children: ReactElement; delay?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const r = ref.current?.getBoundingClientRect();
      if (r) setPos({ x: r.left + r.width / 2, y: r.bottom + 6 });
    }, delay);
  };
  const hide = () => { window.clearTimeout(timer.current); setPos(null); };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    if (!pos) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPos(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pos]);
  const tip = usePortal(
    pos && label ? (
      <div role="tooltip" className="ea-tip" style={{ left: pos.x, top: pos.y, transform: "translateX(-50%)" }}>{label}</div>
    ) : null,
  );
  return (
    <span ref={ref} style={{ display: "inline-flex", minWidth: 0 }} onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {children}
      {tip}
    </span>
  );
}

/* ---------- Popover ---------- */
export function usePopover() {
  const [open, setOpen] = useState(false);
  const [el, setEl] = useState<HTMLButtonElement | null>(null);
  // A ref-shaped handle backed by state, so reading it while rendering is safe and the popover re-anchors on mount.
  const triggerRef = useMemo<RefObject<HTMLButtonElement | null>>(() => ({ get current() { return el; }, set current(v) { setEl(v); } }), [el]);
  const close = useCallback(() => { setOpen(false); el?.focus(); }, [el]);
  return { open, setOpen, triggerRef, close, toggle: () => setOpen((o) => !o) };
}

export function Popover({
  open, onClose, anchor, align = "start", children, pad = false, label,
}: {
  open: boolean; onClose: () => void; anchor: RefObject<HTMLElement | null>; align?: "start" | "end";
  children: ReactNode; pad?: boolean; label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({ visibility: "hidden" });
  useLayoutEffect(() => {
    if (!open) return;
    const a = anchor.current?.getBoundingClientRect();
    if (!a) return;
    const w = ref.current?.offsetWidth ?? 200;
    const left = align === "end" ? Math.max(8, a.right - w) : Math.min(a.left, window.innerWidth - w - 8);
    const h = ref.current?.offsetHeight ?? 0;
    const top = a.bottom + 4 + h > window.innerHeight ? Math.max(8, a.top - h - 4) : a.bottom + 4;
    setStyle({ left, top, maxHeight: window.innerHeight - 16, overflow: "auto" });
  }, [open, anchor, align, children]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !anchor.current?.contains(t)) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    ref.current?.querySelector<HTMLElement>("input,button:not(:disabled),[tabindex]")?.focus();
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onDown); };
  }, [open, onClose, anchor]);
  return usePortal(
    open ? (
      <div ref={ref} className="ea-pop" data-pad={pad || undefined} style={style} role="dialog" aria-label={label}>{children}</div>
    ) : null,
  );
}

export type MenuEntry = { id: string; label: ReactNode; icon?: ReactNode; onSelect?: () => void; disabled?: boolean; separatorBefore?: boolean };

export function Menu({ open, onClose, anchor, items, align = "start" }: {
  open: boolean; onClose: () => void; anchor: RefObject<HTMLElement | null>; items: MenuEntry[]; align?: "start" | "end";
}) {
  const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const els = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
    const i = els.indexOf(document.activeElement as HTMLButtonElement);
    els[(i + (e.key === "ArrowDown" ? 1 : -1) + els.length) % els.length]?.focus();
  };
  return (
    <Popover open={open} onClose={onClose} anchor={anchor} align={align}>
      <div role="menu" onKeyDown={onKey}>
        {items.map((it) => (
          <div key={it.id}>
            {it.separatorBefore && <div className="ea-menu-sep" role="separator" />}
            <button role="menuitem" className="ea-menu-item" disabled={it.disabled} onClick={() => { it.onSelect?.(); onClose(); }}>
              {it.icon}{it.label}
            </button>
          </div>
        ))}
      </div>
    </Popover>
  );
}

/* ---------- Modal / ConfirmDialog ---------- */
function useModalKeys(onClose: () => void) {
  const prev = useRef<Element | null>(document.activeElement);
  useEffect(() => {
    const p = prev.current as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); p?.focus?.(); };
  }, [onClose]);
}

export function Modal({ title, onClose, children, wide, actions }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean; actions?: ReactNode }) {
  useModalKeys(onClose);
  return usePortal(
    <div className="ea-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ea-dialog" data-wide={wide || undefined} role="dialog" aria-modal="true" aria-label={title}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <h2 className="ea-section-title">{title}</h2>
          <button className="ea-icon-btn" data-size="sm" aria-label="Close" onClick={onClose}><X size={18} /></button>
        </div>
        <div style={{ overflow: "auto", minHeight: 0 }}>{children}</div>
        {actions && <div className="ea-dialog-actions">{actions}</div>}
      </div>
    </div>,
  );
}

/** Required for every delete or irreversible action. Cancel has default focus. */
export function ConfirmDialog({ title, body, confirmLabel, onConfirm, onCancel }: {
  title: string; body: ReactNode; confirmLabel: string; onConfirm: () => void; onCancel: () => void;
}) {
  useModalKeys(onCancel);
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => cancelRef.current?.focus(), []);
  return usePortal(
    <div className="ea-overlay" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="ea-dialog" role="alertdialog" aria-modal="true" aria-label={title}>
        <h2 className="ea-section-title">{title}</h2>
        <div className="ea-muted">{body}</div>
        <div className="ea-dialog-actions">
          <Button ref={cancelRef} variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>,
  );
}

/** Right-hand drawer (480px). */
export function Drawer({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useModalKeys(onClose);
  return usePortal(
    <>
      <div className="ea-drawer-overlay" onMouseDown={onClose} />
      <aside className="ea-drawer" role="dialog" aria-modal="true" aria-label={title}>
        <div className="ea-drawer-head">
          <h2 className="ea-section-title">{title}</h2>
          <button className="ea-icon-btn" data-size="sm" aria-label="Close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="ea-drawer-body">{children}</div>
        {footer && <div className="ea-drawer-foot">{footer}</div>}
      </aside>
    </>,
  );
}

/** Wrap a trigger element so a Tip shows its disabled reason. */
export function WithReason({ reason, children }: { reason?: string; children: ReactElement }) {
  if (!reason || !isValidElement(children)) return children;
  return <Tip label={reason}>{cloneElement(children)}</Tip>;
}
