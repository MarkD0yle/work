export const title = "Div Claim Automation";
export const section = "processing";
export const fullWidth = true;

/* Div Claim Automation — an interactive UX prototype of a dividend processing
 * back-office. Mock data only; every flow (create/edit rule → diff preview →
 * request → approve/reject → notification → production) is wired end-to-end
 * inside this page. Light/dark themes run on CSS tokens; the dark palette is
 * based on the "Claim - Dark Console" reference. */

import { useState } from "react";
import type { Role, Route } from "../components/dca/types";
import { DcaProvider, useDca } from "../components/dca/store";
import { Icons, ToastHost } from "../components/dca/ui";
import {
  ApprovalsScreen,
  ClaimsScreen,
  EntitlementsScreen,
  EventsScreen,
  HomeScreen,
  MyRequestsScreen,
  RulesScreen,
  TaxMarkersScreen,
  TradeActionsScreen,
} from "../components/dca/screens";

/* ------------------------------------------------------------------ */
/* Theme tokens                                                        */
/* ------------------------------------------------------------------ */

const STYLES = `
.dca {
  --bg:#f4f6f8; --sf:#ffffff; --sf2:#eef1f4; --bd:#dde3e9; --bd2:#b8c2cc;
  --tx:#16202b; --mut:#5a6875; --fnt:#8b98a5;
  --acc:#2563eb; --acc-tx:#ffffff; --acc-soft:#e8effc;
  --green-tx:#15803d; --green-bg:#e7f6ec; --green-bd:#b5e2c4;
  --amber-tx:#b45309; --amber-bg:#fdf3e0; --amber-bd:#f3ddb0;
  --red-tx:#dc2626; --red-bg:#fdecec; --red-bd:#f5c2c2;
  --gray-tx:#64748b; --gray-bg:#eef1f4; --gray-bd:#d8dee5;
  --blue-tx:#2563eb; --blue-bg:#e8effc; --blue-bd:#c1d4f6;
  --exc:#fdf3e0; --hover:rgba(22,32,43,0.04);
  background:var(--bg); color:var(--tx);
  font-size:13px;
}
.dca[data-theme="dark"] {
  --bg:#0a0a0a; --sf:#161616; --sf2:#1f1f1f; --bd:#2a2a2a; --bd2:#454545;
  --tx:#e5e5e5; --mut:#a3a3a3; --fnt:#737373;
  --acc:#22d3ee; --acc-tx:#083344; --acc-soft:rgba(34,211,238,0.12);
  --green-tx:#4ade80; --green-bg:rgba(74,222,128,0.10); --green-bd:rgba(74,222,128,0.30);
  --amber-tx:#fbbf24; --amber-bg:rgba(251,191,36,0.10); --amber-bd:rgba(251,191,36,0.30);
  --red-tx:#f87171; --red-bg:rgba(248,113,113,0.12); --red-bd:rgba(248,113,113,0.30);
  --gray-tx:#a3a3a3; --gray-bg:#262626; --gray-bd:#454545;
  --blue-tx:#67e8f9; --blue-bg:rgba(103,232,249,0.10); --blue-bd:rgba(103,232,249,0.30);
  --exc:rgba(251,191,36,0.08); --hover:rgba(255,255,255,0.05);
}
.dca .dca-muted{color:var(--mut)} .dca .dca-faint{color:var(--fnt)}
.dca .dca-accent-text{color:var(--acc)} .dca .dca-red-text{color:var(--red-tx)}
.dca .dca-mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-variant-numeric:tabular-nums}
.dca .dca-card{background:var(--sf);border:1px solid var(--bd)}
.dca .dca-panel{background:var(--sf2);border:1px solid var(--bd)}
.dca .dca-divide>*+*{border-top:1px solid var(--bd)}
.dca .dca-total{border-top:1px solid var(--bd2)}
.dca .dca-btn{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--bd2);background:var(--sf);color:var(--tx);font-size:12px;font-weight:500;padding:6px 12px;cursor:pointer}
.dca .dca-btn:hover:not(:disabled){background:var(--sf2)}
.dca .dca-btn:disabled{opacity:.45;cursor:not-allowed}
.dca .dca-btn-sm{padding:4px 9px;font-size:11.5px}
.dca .dca-btn-primary{background:var(--acc);border-color:var(--acc);color:var(--acc-tx)}
.dca .dca-btn-primary:hover:not(:disabled){opacity:.88;background:var(--acc)}
.dca .dca-btn-danger{background:transparent;border-color:var(--red-bd);color:var(--red-tx)}
.dca .dca-btn-danger:hover:not(:disabled){background:var(--red-bg)}
.dca .dca-btn-ghost{border-color:transparent;background:transparent;color:var(--mut)}
.dca .dca-iconbtn{display:inline-flex;align-items:center;justify-content:center;height:24px;width:24px;color:var(--mut);cursor:pointer;border:none;background:transparent}
.dca .dca-iconbtn:hover:not(:disabled){background:var(--hover);color:var(--tx)}
.dca .dca-iconbtn:disabled{opacity:.35;cursor:default}
.dca .dca-input{background:var(--sf);border:1px solid var(--bd2);color:var(--tx);padding:0 8px;font-size:13px;outline:none}
.dca .dca-input:focus{border-color:var(--acc)}
.dca .dca-input:disabled{background:var(--sf2);color:var(--mut)}
.dca textarea.dca-input{padding:6px 8px;resize:vertical}
.dca .dca-check{accent-color:var(--acc);cursor:pointer}
.dca .dca-chip{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--bd2);background:var(--sf);color:var(--mut);font-size:11.5px;font-weight:500;padding:4px 9px;cursor:pointer;white-space:nowrap}
.dca .dca-chip:hover{background:var(--sf2)}
.dca .dca-chip-on{background:var(--acc-soft);border-color:var(--acc);color:var(--tx)}
.dca .dca-pop{background:var(--sf);border:1px solid var(--bd2);box-shadow:0 8px 24px rgba(0,0,0,.18)}
.dca .dca-pop-item{display:block;width:100%;text-align:left;padding:6px 12px;font-size:12px;color:var(--tx);background:transparent;border:none;cursor:pointer}
.dca .dca-pop-item:hover{background:var(--hover)}
.dca .dca-pop-item-on{background:var(--acc-soft)}
.dca .dca-tab{padding:4px 10px;font-size:11.5px;font-weight:500;color:var(--mut);background:transparent;border:1px solid transparent;cursor:pointer}
.dca .dca-tab:hover{color:var(--tx)}
.dca .dca-tab-on{background:var(--sf);border-color:var(--bd2);color:var(--tx)}
.dca .dca-thead th{background:var(--sf2);border-bottom:1px solid var(--bd);color:var(--mut)}
.dca .dca-row td{border-bottom:1px solid var(--bd)}
.dca .dca-row:hover td{background:var(--hover)}
.dca .dca-row-open td{background:var(--acc-soft)}
.dca .dca-dim{opacity:.5}
.dca td.dca-exc{background:var(--exc)}
.dca .dca-grouphead td{background:var(--sf2);border-bottom:1px solid var(--bd);color:var(--mut)}
.dca .dca-badge{display:inline-flex;align-items:center;padding:1px 7px;font-size:10.5px;font-weight:600;border:1px solid}
.dca .dca-b-green{color:var(--green-tx);background:var(--green-bg);border-color:var(--green-bd)}
.dca .dca-b-amber{color:var(--amber-tx);background:var(--amber-bg);border-color:var(--amber-bd)}
.dca .dca-b-red{color:var(--red-tx);background:var(--red-bg);border-color:var(--red-bd)}
.dca .dca-b-gray{color:var(--gray-tx);background:var(--gray-bg);border-color:var(--gray-bd)}
.dca .dca-b-blue{color:var(--blue-tx);background:var(--blue-bg);border-color:var(--blue-bd)}
.dca .dca-bulk{background:var(--acc-soft);border:1px solid var(--acc);border-bottom:none}
.dca .dca-bulk-btn{font-weight:600;color:var(--acc);text-decoration:underline;text-underline-offset:2px;background:none;border:none;cursor:pointer;font-size:12px}
.dca .dca-newdot{display:inline-block;height:7px;width:7px;border-radius:9999px;background:var(--acc)}
.dca .dca-dot-unread{display:inline-block;border-radius:9999px;background:var(--acc)}
.dca .dca-dot-read{display:inline-block;border-radius:9999px;background:var(--bd2)}
.dca .dca-drawer{background:var(--sf);border-left:1px solid var(--bd2);box-shadow:-12px 0 32px rgba(0,0,0,.16)}
.dca .dca-drawer-head{background:var(--sf2);border-bottom:1px solid var(--bd)}
.dca-modal{background:var(--sf);border:1px solid var(--bd2);box-shadow:0 20px 60px rgba(0,0,0,.35);color:var(--tx)}
.dca .dca-modal-head{background:var(--sf2);border-bottom:1px solid var(--bd)}
.dca .dca-modal-foot{background:var(--sf2);border-top:1px solid var(--bd)}
.dca .dca-toast{background:var(--sf);border:1px solid var(--bd2);box-shadow:0 8px 24px rgba(0,0,0,.22);color:var(--tx)}
.dca .dca-warn{color:var(--amber-tx);background:var(--amber-bg);border:1px solid var(--amber-bd)}
.dca .dca-reject{color:var(--red-tx);background:var(--red-bg);border:1px solid var(--red-bd);border-left-width:3px}
.dca .dca-reject .dca-btn{margin-top:8px}
.dca .dca-form-section{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--mut);border-bottom:1px solid var(--bd);padding-bottom:4px;margin-bottom:10px}
.dca .dca-lock{font-size:9.5px;font-weight:600;text-transform:uppercase;color:var(--fnt);border:1px solid var(--bd2);padding:0 4px}
.dca .dca-modified{font-size:9.5px;font-weight:600;text-transform:uppercase;color:var(--amber-tx);background:var(--amber-bg);border:1px solid var(--amber-bd);padding:0 4px}
.dca .dca-step-dot{display:inline-flex;align-items:center;justify-content:center;height:18px;width:18px;border-radius:9999px;border:1.5px solid var(--bd2);background:var(--sf);flex-shrink:0}
.dca .dca-step-done{background:var(--acc);border-color:var(--acc);color:var(--acc-tx)}
.dca .dca-step-current{border-color:var(--acc);box-shadow:0 0 0 3px var(--acc-soft)}
.dca .dca-step-rejected{background:var(--red-tx);border-color:var(--red-tx);color:#fff}
.dca .dca-step-line{background:var(--bd2)}
.dca .dca-step-line-done{background:var(--acc)}
.dca .dca-tl-dot{height:8px;width:8px;border-radius:9999px;background:var(--bd2);margin-top:4px;flex-shrink:0}
.dca .dca-tl-dot-last{background:var(--acc)}
.dca .dca-tl-line{background:var(--bd)}
.dca .dca-diff-head{background:var(--sf2);color:var(--mut);border-bottom:1px solid var(--bd)}
.dca .dca-diff-row{border-bottom:1px solid var(--bd)}
.dca .dca-diff-row:last-child{border-bottom:none}
.dca .dca-diff-before{color:var(--mut)}
.dca .dca-diff-after{background:var(--acc-soft);padding:0 4px;align-self:start}
.dca .dca-homecard{cursor:pointer;transition:border-color .12s}
.dca .dca-homecard:hover{border-color:var(--acc)}
.dca .dca-notifrow{background:transparent;border:none;cursor:pointer}
.dca .dca-notifrow:hover{background:var(--hover)}
.dca .dca-nav{display:flex;align-items:center;gap:8px;width:100%;text-align:left;padding:6px 12px;font-size:12.5px;color:var(--mut);background:transparent;border:none;border-left:2px solid transparent;cursor:pointer}
.dca .dca-nav:hover{color:var(--tx);background:var(--hover)}
.dca .dca-nav-on{color:var(--tx);background:var(--acc-soft);border-left-color:var(--acc);font-weight:600}
.dca .dca-navlabel{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--fnt);padding:14px 12px 4px}
.dca .dca-countpill{margin-left:auto;font-size:10px;font-weight:700;padding:0 6px;background:var(--acc);color:var(--acc-tx);border-radius:9999px}
`;

/* ------------------------------------------------------------------ */
/* Shell                                                               */
/* ------------------------------------------------------------------ */

const NAV: { label: string; items: { key: Route["screen"]; label: string; approverOnly?: boolean }[] }[] = [
  {
    label: "Workspace",
    items: [
      { key: "home", label: "Home" },
      { key: "myRequests", label: "My Requests" },
      { key: "approvals", label: "Approvals", approverOnly: true },
    ],
  },
  {
    label: "Rule Management",
    items: [
      { key: "rules", label: "Dividend Claim Rules" },
      { key: "tradeActions", label: "Trade Action Rules" },
      { key: "taxMarkers", label: "Tax Markers" },
    ],
  },
  {
    label: "Claim Processing",
    items: [
      { key: "events", label: "Dividend Events" },
      { key: "entitlements", label: "Trade Entitlements" },
      { key: "claims", label: "Dividend Claims" },
    ],
  },
];

function Bell() {
  const { notifs, userName, unreadCount, markNotifRead, navigate } = useDca();
  const [open, setOpen] = useState(false);
  const mine = notifs.filter((n) => n.forUser === userName).slice(0, 6);
  return (
    <div className="relative">
      <button
        type="button"
        className="dca-iconbtn relative h-8 w-8"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
      >
        {Icons.bell()}
        {unreadCount > 0 && (
          <span className="dca-countpill absolute -right-0.5 -top-0.5 !ml-0">{unreadCount}</span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="dca-pop absolute right-0 top-full z-30 mt-1 w-80">
            <p className="dca-navlabel !p-2.5 !pb-1">Notifications — {userName}</p>
            {mine.length === 0 ? (
              <p className="dca-faint px-3 pb-3 pt-1 text-[12px]">Nothing yet — approvals and rejections land here.</p>
            ) : (
              <div className="dca-divide max-h-80 overflow-y-auto">
                {mine.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    className="dca-notifrow flex w-full items-start gap-2 px-3 py-2.5 text-left"
                    onClick={() => {
                      markNotifRead(n.id);
                      setOpen(false);
                      if (n.requestId) navigate({ screen: "myRequests", openId: n.requestId });
                    }}
                  >
                    <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 ${n.read ? "dca-dot-read" : "dca-dot-unread"}`} />
                    <span className={`flex-1 text-[12px] ${n.read ? "dca-muted" : "font-medium"}`}>{n.text}</span>
                    <span className="dca-faint whitespace-nowrap text-[10px]">{n.time.slice(5)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Shell() {
  const {
    role,
    setRole,
    theme,
    toggleTheme,
    route,
    navNonce,
    navigate,
    pendingApprovals,
    resetDemo,
  } = useDca();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const screen = (() => {
    switch (route.screen) {
      case "home":
        return <HomeScreen />;
      case "rules":
        return <RulesScreen openId={route.openId} />;
      case "tradeActions":
        return <TradeActionsScreen openId={route.openId} />;
      case "taxMarkers":
        return <TaxMarkersScreen openId={route.openId} />;
      case "myRequests":
        return <MyRequestsScreen openId={route.openId} statusFilter={route.statusFilter} />;
      case "approvals":
        return <ApprovalsScreen openId={route.openId} />;
      case "events":
        return <EventsScreen openId={route.openId} />;
      case "entitlements":
        return <EntitlementsScreen eventId={route.eventId} openId={route.openId} />;
      case "claims":
        return <ClaimsScreen statusFilter={route.statusFilter} openId={route.openId} />;
    }
  })();

  return (
    <div className="dca flex h-screen overflow-hidden font-sans antialiased" data-theme={theme}>
      <style>{STYLES}</style>

      {/* Sidebar */}
      {sidebarOpen && (
        <aside className="dca-card flex w-56 shrink-0 flex-col border-b-0 border-l-0 border-t-0">
          <div className="flex items-center gap-2 px-3 py-3" style={{ borderBottom: "1px solid var(--bd)" }}>
            <span className="dca-mono text-[13px] font-bold tracking-wide" style={{ color: "var(--acc)" }}>
              DIV·CLAIM
            </span>
            <span className="dca-faint text-[10px] uppercase tracking-widest">Automation</span>
          </div>
          <nav className="flex-1 overflow-y-auto pb-4">
            {NAV.map((sec) => (
              <div key={sec.label}>
                <p className="dca-navlabel">{sec.label}</p>
                {sec.items
                  .filter((i) => !i.approverOnly || role === "Approver")
                  .map((i) => (
                    <button
                      key={i.key}
                      type="button"
                      className={`dca-nav ${route.screen === i.key ? "dca-nav-on" : ""}`}
                      onClick={() => navigate({ screen: i.key } as Route)}
                    >
                      {i.label}
                      {i.key === "approvals" && pendingApprovals > 0 && (
                        <span className="dca-countpill">{pendingApprovals}</span>
                      )}
                    </button>
                  ))}
              </div>
            ))}
          </nav>
          <div className="px-3 py-3" style={{ borderTop: "1px solid var(--bd)" }}>
            <button
              type="button"
              className="dca-faint text-[11px] underline underline-offset-2"
              onClick={resetDemo}
            >
              Reset demo data
            </button>
          </div>
        </aside>
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header
          className="flex shrink-0 items-center gap-3 px-4 py-2"
          style={{ background: "var(--sf)", borderBottom: "1px solid var(--bd)" }}
        >
          <button
            type="button"
            className="dca-iconbtn h-8 w-8"
            onClick={() => setSidebarOpen((o) => !o)}
            aria-label="Toggle sidebar"
            title="Toggle sidebar"
          >
            {Icons.collapse()}
          </button>
          <span className="text-[13px] font-semibold">Dividend Processing</span>
          <span className="dca-faint text-[11px]">UX prototype · mock data</span>
          <div className="ml-auto flex items-center gap-2">
            <Bell />
            <button
              type="button"
              className="dca-iconbtn h-8 w-8"
              onClick={toggleTheme}
              aria-label="Toggle dark mode"
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? Icons.sun() : Icons.moon()}
            </button>
            <select
              className="dca-input h-8 text-[12px]"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              aria-label="Switch role"
            >
              <option value="Maker">Maker – Kim</option>
              <option value="Approver">Approver – Lee</option>
              <option value="Operations">Operations – Park</option>
            </select>
          </div>
        </header>

        {/* Screen */}
        <main key={navNonce} className="min-h-0 flex-1 overflow-y-auto p-5">
          {screen}
        </main>
      </div>

      <ToastHost />
    </div>
  );
}

export default function DivClaimAutomation() {
  return (
    <DcaProvider>
      <Shell />
    </DcaProvider>
  );
}
