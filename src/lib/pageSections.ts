/* Section metadata for the sidebar.
 *
 * Pages are auto-discovered from src/pages (see App.tsx). To keep the
 * sidebar organised, each page is assigned to a section. A page can opt
 * into a section explicitly via `export const section = "..."`; otherwise
 * we fall back to the slug → section map below. Anything unmapped lands in
 * the catch-all "Other" section so new files still show up.
 */

export type SectionDef = {
  id: string;
  label: string;
  /** Inline SVG path (20x20 viewBox) used as the section icon. */
  iconPath: string;
};

export const OTHER_SECTION_ID = "other";

export const SECTIONS: SectionDef[] = [
  {
    id: "operations",
    label: "Operations",
    iconPath:
      "M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.53 1.53 0 0 1-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 0 1 .947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 0 1 2.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 0 1 2.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 0 1 .947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 0 1-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 0 1-2.287-.947ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  },
  {
    id: "risk",
    label: "Risk & Exposure",
    iconPath:
      "M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
  },
  {
    id: "trading",
    label: "Trading & Liquidity",
    iconPath:
      "M15.98 1.804a1 1 0 0 0-1.96 0l-.24 1.192a1 1 0 0 1-.784.785l-1.192.238a1 1 0 0 0 0 1.962l1.192.238a1 1 0 0 1 .785.785l.238 1.192a1 1 0 0 0 1.962 0l.238-1.192a1 1 0 0 1 .785-.785l1.192-.238a1 1 0 0 0 0-1.962l-1.192-.238a1 1 0 0 1-.785-.785l-.238-1.192ZM6.949 5.684a1 1 0 0 0-1.898 0l-.683 2.051a1 1 0 0 1-.633.633l-2.051.683a1 1 0 0 0 0 1.898l2.051.684a1 1 0 0 1 .633.632l.683 2.051a1 1 0 0 0 1.898 0l.683-2.051a1 1 0 0 1 .633-.633l2.051-.683a1 1 0 0 0 0-1.898l-2.051-.683a1 1 0 0 1-.633-.633L6.95 5.684ZM13.949 13.684a1 1 0 0 0-1.898 0l-.184.551a1 1 0 0 1-.632.633l-.551.183a1 1 0 0 0 0 1.898l.551.183a1 1 0 0 1 .633.633l.183.551a1 1 0 0 0 1.898 0l.184-.551a1 1 0 0 1 .632-.633l.551-.183a1 1 0 0 0 0-1.898l-.551-.184a1 1 0 0 1-.633-.632l-.183-.551Z",
  },
  {
    id: "forms",
    label: "Forms & Flows",
    iconPath:
      "M4 2.5A1.5 1.5 0 0 0 2.5 4v12A1.5 1.5 0 0 0 4 17.5h12a1.5 1.5 0 0 0 1.5-1.5V4A1.5 1.5 0 0 0 16 2.5H4ZM6 6.25a.75.75 0 0 1 .75-.75h6.5a.75.75 0 0 1 0 1.5h-6.5A.75.75 0 0 1 6 6.25Zm0 3.5a.75.75 0 0 1 .75-.75h6.5a.75.75 0 0 1 0 1.5h-6.5a.75.75 0 0 1-.75-.75Zm.75 2.75a.75.75 0 0 0 0 1.5h3.5a.75.75 0 0 0 0-1.5h-3.5Z",
  },
  {
    id: "portfolio-analytics",
    label: "Portfolio Analytics",
    iconPath:
      "M3 3a1 1 0 0 0-1 1v12a2 2 0 0 0 2 2h13a1 1 0 1 0 0-2H4V4a1 1 0 0 0-1-1Zm11.71 3.29a1 1 0 0 1 0 1.42l-3.5 3.5a1 1 0 0 1-1.42 0L8 8.41l-2.29 2.3a1 1 0 1 1-1.42-1.42l3-3a1 1 0 0 1 1.42 0L10.5 8.09l2.79-2.8a1 1 0 0 1 1.42 0Z",
  },
  {
    id: "wealth",
    label: "Wealth & Clients",
    iconPath:
      "M10 9a3 3 0 100-6 3 3 0 000 6ZM6 8a2 2 0 11-4 0 2 2 0 014 0ZM1.49 15.326a.78.78 0 01-.358-.442 3 3 0 014.308-3.516 6.484 6.484 0 00-1.905 3.959c-.023.222-.014.442.025.654a4.97 4.97 0 01-2.07-.655ZM16.44 15.98a4.97 4.97 0 002.07-.654.78.78 0 00.357-.442 3 3 0 00-4.308-3.517 6.484 6.484 0 011.907 3.96 2.32 2.32 0 01-.026.654ZM18 8a2 2 0 11-4 0 2 2 0 014 0ZM5.304 16.19a.844.844 0 01-.277-.71 5 5 0 019.947 0 .843.843 0 01-.277.71A6.975 6.975 0 0110 18a6.974 6.974 0 01-4.696-1.81Z",
  },
  {
    id: "patterns",
    label: "Patterns & Tools",
    iconPath:
      "M17.663 3.118c.225.015.45.032.673.05C19.876 3.298 21 4.604 21 6.109v9.642a3 3 0 0 1-3 3V16.5c0-5.922-4.576-10.775-10.384-11.217.324-1.132 1.3-2.01 2.548-2.114.224-.019.448-.036.673-.051A3 3 0 0 1 13.5 1.5H15a3 3 0 0 1 2.663 1.618ZM12 4.5A1.5 1.5 0 0 1 13.5 3H15a1.5 1.5 0 0 1 1.5 1.5H12Z M3 8.625c0-1.036.84-1.875 1.875-1.875h.375A3.75 3.75 0 0 1 9 10.5v1.875c0 1.036.84 1.875 1.875 1.875h1.875A3.75 3.75 0 0 1 16.5 18v.375c0 1.036-.84 1.875-1.875 1.875h-9.75A1.875 1.875 0 0 1 3 18.375V8.625Z",
  },
  {
    id: "pitch",
    label: "Sales & Pitch",
    iconPath:
      "M2 10.5a.75.75 0 0 1 .75-.75h1.638a2.25 2.25 0 0 1 1.941 1.11l.858 1.463a.25.25 0 0 0 .216.127h4.194a.25.25 0 0 0 .216-.127l.858-1.462a2.25 2.25 0 0 1 1.941-1.111h1.638a.75.75 0 0 1 0 1.5h-1.638a.75.75 0 0 0-.647.37l-.858 1.463a1.75 1.75 0 0 1-1.51.887H7.403a1.75 1.75 0 0 1-1.51-.887l-.858-1.462a.75.75 0 0 0-.647-.371H2.75A.75.75 0 0 1 2 10.5ZM10 2a.75.75 0 0 1 .75.75v.5a.75.75 0 0 1-1.5 0v-.5A.75.75 0 0 1 10 2ZM5.05 4.05a.75.75 0 0 1 1.06 0l.354.353a.75.75 0 0 1-1.06 1.061l-.354-.354a.75.75 0 0 1 0-1.06Zm9.9 0a.75.75 0 0 1 0 1.06l-.354.354a.75.75 0 1 1-1.06-1.06l.353-.354a.75.75 0 0 1 1.06 0ZM3 15.25A2.25 2.25 0 0 1 5.25 13h9.5A2.25 2.25 0 0 1 17 15.25v.25a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 15.5v-.25Z",
  },
];

/* slug → section id. Keep grouped by section for readability. */
const SLUG_SECTION: Record<string, string> = {
  // Portfolio Analytics
  "asset-screener": "portfolio-analytics",
  "bond-replacement": "portfolio-analytics",

  // Operations
  "ops-overview": "operations",
  oversight: "operations",
  "my-queue": "operations",
  "nav-signoff": "operations",
  reconciliation: "operations",
  "trade-investigation": "operations",
  "payments-center": "operations",
  "corp-actions": "operations",
  "settlement-timeline": "operations",

  // Forms & Flows
  "client-onboarding": "forms",
  "counterparty-onboarding": "forms",
  "sign-up": "forms",
  settings: "forms",

  // Risk & Exposure
  "credit-exposure": "risk",
  "counterparty-360": "risk",
  "limit-monitor": "risk",
  "stress-scenarios": "risk",
  "exposure-treemap": "risk",
  oprisk: "risk",
  "xva-desk": "risk",
  "op-risk-event": "risk",
  "control-attestation": "risk",
  "limit-breach": "risk",
  "new-product-approval": "risk",

  // Trading & Liquidity
  blotter: "trading",
  "devextreme-blotter": "trading",
  "tca-execution": "trading",
  "liquidity-ladder": "trading",
  "repo-financing": "trading",
  "collateral-optimizer": "trading",
  ccymgmt: "trading",
  heatmap: "trading",
  "tracs-heatmap": "trading",
  "trade-amendment": "trading",
  "block-allocation": "trading",
  "fx-hedge-order": "trading",
  "settlement-instruction": "trading",
  "margin-call": "trading",
  "collateral-substitution": "trading",

  // Wealth & Clients
  "client-overview": "wealth",
  "portfolio-performance": "wealth",
  "wealth-summary": "wealth",
  "asset-allocation": "wealth",
  "financial-goals": "wealth",

  // Patterns & Tools
  "pattern-gallery": "patterns",
  "github-cheatsheet": "patterns",
  "date-picker-business-day": "patterns",
  "date-picker-settlement": "patterns",
  "date-picker-range": "patterns",

  // Sales & Pitch
  "pitch-builder": "pitch",
  "pitch-library": "pitch",
  "pitch-perfect": "pitch",
};

export function sectionForSlug(slug: string, explicit?: string): string {
  if (explicit) return explicit;
  return SLUG_SECTION[slug] ?? OTHER_SECTION_ID;
}

export function sectionLabel(id: string): string {
  return SECTIONS.find((s) => s.id === id)?.label ?? "Other";
}
