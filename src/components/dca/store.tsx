/* App store for the Div Claim Automation prototype — React context, no backend.
 * All mutations run against in-memory state so the full maker-checker loop can
 * be demonstrated live in one session. */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  Claim,
  DivEvent,
  Entitlement,
  FieldChange,
  Notif,
  RequestType,
  Role,
  Route,
  Rule,
  TaxMarker,
  Toast,
  TradeActionRule,
  WfRequest,
} from "./types";
import {
  SEED_CLAIMS,
  SEED_ENTITLEMENTS,
  SEED_EVENTS,
  SEED_NOTIFS,
  SEED_REQUESTS,
  SEED_RULES,
  SEED_TAX_MARKERS,
  SEED_TA_RULES,
  USERS,
  nowStamp,
} from "./data";

export type Theme = "light" | "dark";

const THEME_KEY = "dca-theme";

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* ignore */
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export interface SubmitInput {
  type: RequestType;
  targetId: string | null;
  targetLabel: string;
  entity: "rule" | "ta" | "tm";
  values: Record<string, string | number | boolean>;
  changes: FieldChange[];
  reason: string;
}

interface StoreValue {
  role: Role;
  userName: string;
  theme: Theme;
  route: Route;
  navNonce: number;
  rules: Rule[];
  taRules: TradeActionRule[];
  taxMarkers: TaxMarker[];
  requests: WfRequest[];
  events: DivEvent[];
  entitlements: Entitlement[];
  claims: Claim[];
  notifs: Notif[];
  toasts: Toast[];
  pendingApprovals: number;
  unreadCount: number;
  setRole: (r: Role) => void;
  toggleTheme: () => void;
  navigate: (r: Route) => void;
  submitRequest: (input: SubmitInput) => string;
  approveRequest: (id: string) => void;
  rejectRequest: (id: string, reason: string) => void;
  resolveClaim: (id: string, comment: string) => void;
  deactivateRules: (ids: string[]) => void;
  markNotifRead: (id: string) => void;
  dismissToast: (id: number) => void;
  pushToast: (text: string, link?: Toast["link"]) => void;
  resetDemo: () => void;
}

const StoreCtx = createContext<StoreValue | null>(null);

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export function DcaProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>("Maker");
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [route, setRoute] = useState<Route>({ screen: "home" });
  const [navNonce, setNavNonce] = useState(0);
  const [rules, setRules] = useState<Rule[]>(() => clone(SEED_RULES));
  const [taRules, setTaRules] = useState<TradeActionRule[]>(() => clone(SEED_TA_RULES));
  const [taxMarkers, setTaxMarkers] = useState<TaxMarker[]>(() => clone(SEED_TAX_MARKERS));
  const [requests, setRequests] = useState<WfRequest[]>(() => clone(SEED_REQUESTS));
  const [events] = useState<DivEvent[]>(() => clone(SEED_EVENTS));
  const [entitlements] = useState<Entitlement[]>(() => clone(SEED_ENTITLEMENTS));
  const [claims, setClaims] = useState<Claim[]>(() => clone(SEED_CLAIMS));
  const [notifs, setNotifs] = useState<Notif[]>(() => clone(SEED_NOTIFS));
  const [toasts, setToasts] = useState<Toast[]>([]);
  const reqSeq = useRef(SEED_REQUESTS.length);
  const ruleSeq = useRef(SEED_RULES.length);
  const toastSeq = useRef(0);
  const notifSeq = useRef(SEED_NOTIFS.length);

  const userName = USERS[role].name;

  const navigate = useCallback((r: Route) => {
    setRoute(r);
    setNavNonce((n) => n + 1);
  }, []);

  const setRole = useCallback((r: Role) => {
    setRoleState(r);
    // Approvals is approver-only; leave it when switching away.
    setRoute((cur) => (cur.screen === "approvals" && r !== "Approver" ? { screen: "home" } : cur));
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (text: string, link?: Toast["link"]) => {
      const id = ++toastSeq.current;
      setToasts((ts) => [...ts, { id, text, link }]);
      window.setTimeout(() => dismissToast(id), 7000);
    },
    [dismissToast],
  );

  const addNotif = useCallback((forUser: string, text: string, requestId?: string) => {
    const id = `NTF-${String(++notifSeq.current).padStart(3, "0")}`;
    setNotifs((ns) => [{ id, forUser, text, requestId, read: false, time: nowStamp() }, ...ns]);
  }, []);

  const submitRequest = useCallback(
    (input: SubmitInput): string => {
      const id = `REQ-${String(++reqSeq.current).padStart(3, "0")}`;
      const time = nowStamp();
      const req: WfRequest = {
        id,
        type: input.type,
        targetId: input.targetId,
        targetLabel: input.targetId ?? "New",
        status: "Submitted",
        submittedBy: userName,
        submittedAt: time,
        updatedAt: time,
        assignee: "Lee",
        reason: input.reason,
        changes: input.changes,
        payload: { entity: input.entity, targetId: input.targetId, values: input.values },
        timeline: [{ label: "Submitted", actor: userName, time }],
      };
      setRequests((rs) => [req, ...rs]);
      addNotif("Lee", `${id} is waiting for your approval (${input.type})`, id);
      pushToast(`Request ${id} submitted for approval`, {
        label: "View request",
        route: { screen: "myRequests", openId: id },
      });
      return id;
    },
    [userName, addNotif, pushToast],
  );

  const applyPayload = useCallback(
    (req: WfRequest): string => {
      const { entity, targetId, values } = req.payload;
      if (entity === "rule") {
        if (targetId) {
          setRules((rs) =>
            rs.map((r) => (r.id === targetId ? { ...r, ...(values as Partial<Rule>), isNew: true } : r)),
          );
          return targetId;
        }
        const id = `DCR-${String(++ruleSeq.current).padStart(3, "0")}`;
        setRules((rs) => [{ ...(values as unknown as Rule), id, isNew: true }, ...rs]);
        return id;
      }
      if (entity === "ta" && targetId) {
        setTaRules((rs) =>
          rs.map((r) => (r.id === targetId ? { ...r, ...(values as Partial<TradeActionRule>) } : r)),
        );
        return targetId;
      }
      if (entity === "tm" && targetId) {
        setTaxMarkers((rs) =>
          rs.map((r) => (r.id === targetId ? { ...r, ...(values as Partial<TaxMarker>) } : r)),
        );
        return targetId;
      }
      return targetId ?? "";
    },
    [],
  );

  const approveRequest = useCallback(
    (id: string) => {
      const req = requests.find((r) => r.id === id);
      if (!req || (req.status !== "Submitted" && req.status !== "In Review")) return;
      const time = nowStamp();
      // Side effects (production update, notification) run once, outside the
      // setState updater, so React StrictMode's double-invoke stays safe.
      const appliedId = applyPayload(req);
      setRequests((rs) =>
        rs.map((r) =>
          r.id === id
            ? {
                ...r,
                status: "Approved" as const,
                updatedAt: time,
                timeline: [
                  ...r.timeline,
                  { label: "Approved", actor: userName, time },
                  { label: "In production", actor: "System", time },
                ],
              }
            : r,
        ),
      );
      addNotif(req.submittedBy, `Your request ${id} was approved — ${appliedId} is now in production`, id);
      pushToast(`${id} approved — change applied to production`);
    },
    [requests, applyPayload, addNotif, pushToast, userName],
  );

  const rejectRequest = useCallback(
    (id: string, reason: string) => {
      const req = requests.find((r) => r.id === id);
      if (!req) return;
      const time = nowStamp();
      setRequests((rs) =>
        rs.map((r) =>
          r.id === id
            ? {
                ...r,
                status: "Rejected" as const,
                rejectionReason: reason,
                updatedAt: time,
                timeline: [...r.timeline, { label: "Rejected", actor: userName, time }],
              }
            : r,
        ),
      );
      addNotif(req.submittedBy, `Your request ${id} was rejected — click to view reason`, id);
      pushToast(`${id} rejected — the maker has been notified`);
    },
    [requests, addNotif, pushToast, userName],
  );

  const resolveClaim = useCallback(
    (id: string, comment: string) => {
      setClaims((cs) =>
        cs.map((c) => (c.id === id ? { ...c, status: "Matched", resolvedComment: comment } : c)),
      );
      pushToast(`${id} marked resolved`);
    },
    [pushToast],
  );

  const deactivateRules = useCallback(
    (ids: string[]) => {
      setRules((rs) => rs.map((r) => (ids.includes(r.id) ? { ...r, active: false } : r)));
      pushToast(`${ids.length} rule${ids.length === 1 ? "" : "s"} deactivated (demo shortcut — skips approval)`);
    },
    [pushToast],
  );

  const markNotifRead = useCallback((id: string) => {
    setNotifs((ns) => ns.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const resetDemo = useCallback(() => {
    setRules(clone(SEED_RULES));
    setTaRules(clone(SEED_TA_RULES));
    setTaxMarkers(clone(SEED_TAX_MARKERS));
    setRequests(clone(SEED_REQUESTS));
    setClaims(clone(SEED_CLAIMS));
    setNotifs(clone(SEED_NOTIFS));
    reqSeq.current = SEED_REQUESTS.length;
    ruleSeq.current = SEED_RULES.length;
    notifSeq.current = SEED_NOTIFS.length;
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("dca-views-"))
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      /* ignore */
    }
    setRoute({ screen: "home" });
    setNavNonce((n) => n + 1);
    pushToast("Demo data reset");
  }, [pushToast]);

  const pendingApprovals = useMemo(
    () => requests.filter((r) => r.status === "Submitted" || r.status === "In Review").length,
    [requests],
  );

  const unreadCount = useMemo(
    () => notifs.filter((n) => n.forUser === userName && !n.read).length,
    [notifs, userName],
  );

  const value: StoreValue = {
    role,
    userName,
    theme,
    route,
    navNonce,
    rules,
    taRules,
    taxMarkers,
    requests,
    events,
    entitlements,
    claims,
    notifs,
    toasts,
    pendingApprovals,
    unreadCount,
    setRole,
    toggleTheme,
    navigate,
    submitRequest,
    approveRequest,
    rejectRequest,
    resolveClaim,
    deactivateRules,
    markNotifRead,
    dismissToast,
    pushToast,
    resetDemo,
  };

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useDca(): StoreValue {
  const v = useContext(StoreCtx);
  if (!v) throw new Error("useDca must be used inside DcaProvider");
  return v;
}
