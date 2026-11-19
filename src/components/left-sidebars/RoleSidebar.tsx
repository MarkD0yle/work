import { useState } from "react";
import { ChevronRight, Lock } from "lucide-react";
import { cx, focus } from "../patterns/tokens";
import { ALL_ITEMS, findItem, type SidebarProps } from "./nav-model";
import { Brand, GroupLabel, NavLink, SidebarFrame, UserFooter } from "./SidebarKit";

/* 10 — Role workspace.
 *
 * One platform, four jobs. The role at the top decides what the sidebar leads
 * with: the six or seven pages that role works in, in the order they use
 * them. Everything else is one click further away, not gone.
 *
 * Entitlements show here too. A page the role may not open is listed with a
 * lock and a reason, because "it isn't there" and "you can't" are different
 * answers and only the second one tells people who to ask.
 */

type Role = {
  id: string;
  label: string;
  entitlement: string;
  /** Pages this role works in, in working order. */
  workspace: string[];
  /** Pages this role cannot open, with the reason shown to the user. */
  locked: Record<string, string>;
};

const ROLES: Role[] = [
  {
    id: "accountant",
    label: "Fund Accountant",
    entitlement: "Maker",
    workspace: ["my-work", "nav-production", "pricing", "accruals", "fees", "cash-rec", "ledger"],
    locked: { "nav-signoff": "Checker only", "investor-kyc": "Transfer Agency only" },
  },
  {
    id: "rec-analyst",
    label: "Reconciliation Analyst",
    entitlement: "Maker",
    workspace: ["my-work", "cash-rec", "position-rec", "transaction-rec", "breaks", "settlements"],
    locked: {
      "nav-signoff": "Checker only",
      ledger: "Fund Accounting only",
      "investor-kyc": "Transfer Agency only",
    },
  },
  {
    id: "ta",
    label: "Transfer Agency Specialist",
    entitlement: "Maker",
    workspace: ["my-work", "dealing", "register", "investor-kyc", "distributions", "fx-cash"],
    locked: { "nav-signoff": "Checker only", ledger: "Fund Accounting only" },
  },
  {
    id: "oversight",
    label: "Oversight Manager",
    entitlement: "Checker",
    workspace: ["nav-signoff", "fund-oversight", "breaks", "regulatory", "client-reporting", "audit"],
    locked: {},
  },
];

export function RoleSidebar({ activeId, onNavigate }: SidebarProps) {
  const [roleId, setRoleId] = useState("accountant");
  const [showRest, setShowRest] = useState(false);
  const role = ROLES.find((r) => r.id === roleId) ?? ROLES[0];
  const rest = ALL_ITEMS.filter((item) => !role.workspace.includes(item.id));

  return (
    <SidebarFrame label="Role workspace sidebar" className="w-64">
      <Brand />

      <div className="shrink-0 border-b border-neutral-200 px-4 py-3">
        <label
          htmlFor="role-sidebar-role"
          className="block text-[10px] font-semibold tracking-widest text-neutral-500 uppercase"
        >
          Working as
        </label>
        <select
          id="role-sidebar-role"
          value={role.id}
          onChange={(e) => setRoleId(e.target.value)}
          className={cx(
            "mt-1 w-full border border-neutral-300 bg-white px-2 py-1.5 text-xs font-semibold text-neutral-900",
            focus,
          )}
        >
          {ROLES.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-neutral-500">
          <span className="rounded-full border border-neutral-300 px-1.5 leading-4 font-medium text-neutral-700">
            {role.entitlement}
          </span>
          <span className="truncate">Aldgate Asset Management</span>
        </div>
      </div>

      <nav aria-label="Primary" className="min-h-0 flex-1 overflow-y-auto pb-3">
        <GroupLabel>Your workspace</GroupLabel>
        <ul>
          {role.workspace.map((id) => {
            const item = findItem(id);
            const Icon = item.module.icon;
            return (
              <li key={id}>
                <NavLink
                  label={item.label}
                  active={id === activeId}
                  onClick={() => onNavigate(id)}
                  count={item.count}
                  tone={item.tone}
                  icon={<Icon aria-hidden className="h-3.5 w-3.5 shrink-0 text-neutral-500" />}
                  className="py-2"
                />
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={() => setShowRest((s) => !s)}
          aria-expanded={showRest}
          className={cx(
            "mt-3 flex w-full items-center gap-2 border-t border-neutral-200 px-4 py-2.5 text-left text-[11px] font-medium text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900",
            focus,
            "focus-visible:-outline-offset-2",
          )}
        >
          <ChevronRight
            aria-hidden
            className={cx(
              "h-3.5 w-3.5 text-neutral-400 transition-transform motion-reduce:transition-none",
              showRest && "rotate-90",
            )}
          />
          Rest of the platform
          <span className="text-neutral-400 tabular-nums">{rest.length}</span>
        </button>
        {showRest && (
          <ul>
            {rest.map((item) => {
              const reason = role.locked[item.id];
              if (reason) {
                return (
                  <li
                    key={item.id}
                    className="flex items-center gap-2 border-l-2 border-l-transparent py-1.5 pr-3 pl-3.5 text-neutral-400"
                  >
                    <Lock aria-hidden className="h-3 w-3 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    <span className="shrink-0 text-[10px]">{reason}</span>
                  </li>
                );
              }
              return (
                <li key={item.id}>
                  <NavLink
                    label={item.label}
                    active={item.id === activeId}
                    onClick={() => onNavigate(item.id)}
                    count={item.count}
                    tone={item.tone}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </nav>
      <UserFooter role={role.label} />
    </SidebarFrame>
  );
}
