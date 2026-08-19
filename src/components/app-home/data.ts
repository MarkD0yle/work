import { ICON } from "./icons";

/* Shared App Home content — the same nine apps, releases and contacts feed
 * both layouts, so switching between them compares presentation only. */

/* ------------------------------------------------------------------ *
 * Applications
 *
 * Accent classes are written out whole. Tailwind scans source text, so an
 * interpolated `bg-${colour}-50` would never be generated — every variant a
 * layout might use has to appear here literally.
 *
 * `slug` points at a real page in this workspace where one exists; tiles
 * without a slug are inert placeholders for apps that live elsewhere.
 * ------------------------------------------------------------------ */

export type AppEntry = {
  name: string;
  icon: string;
  slug?: string;
  /** Resting icon tile — tinted fill + accent glyph. Used by the Cards layout. */
  tile: string;
  /** Icon tile on hover, Cards layout: solid accent, white glyph. */
  tileSolidHover: string;
  /** Icon tile on hover, Sheet layout: monochrome lifts to a tinted accent. */
  tileTintHover: string;
  /** Solid accent bar — top wipe in Cards, left edge in Sheet. */
  bar: string;
};

export const APPS: AppEntry[] = [
  {
    name: "Client Profile",
    icon: ICON.user,
    slug: "client-overview",
    tile: "bg-indigo-50 text-indigo-600",
    tileSolidHover: "group-hover:bg-indigo-600 group-hover:text-white",
    tileTintHover: "group-hover:bg-indigo-50 group-hover:text-indigo-600",
    bar: "bg-indigo-500",
  },
  {
    name: "Air Traffic Control",
    icon: ICON.airplane,
    slug: "ops-overview",
    tile: "bg-sky-50 text-sky-600",
    tileSolidHover: "group-hover:bg-sky-600 group-hover:text-white",
    tileTintHover: "group-hover:bg-sky-50 group-hover:text-sky-600",
    bar: "bg-sky-500",
  },
  {
    name: "Mgmt Report",
    icon: ICON.document,
    slug: "oversight",
    tile: "bg-violet-50 text-violet-600",
    tileSolidHover: "group-hover:bg-violet-600 group-hover:text-white",
    tileTintHover: "group-hover:bg-violet-50 group-hover:text-violet-600",
    bar: "bg-violet-500",
  },
  {
    name: "Legal Entity",
    icon: ICON.building,
    slug: "counterparty-360",
    tile: "bg-slate-100 text-slate-600",
    tileSolidHover: "group-hover:bg-slate-700 group-hover:text-white",
    tileTintHover: "group-hover:bg-slate-100 group-hover:text-slate-700",
    bar: "bg-slate-500",
  },
  {
    name: "Deposit Analytics",
    icon: ICON.chart,
    slug: "wealth-summary",
    tile: "bg-emerald-50 text-emerald-600",
    tileSolidHover: "group-hover:bg-emerald-600 group-hover:text-white",
    tileTintHover: "group-hover:bg-emerald-50 group-hover:text-emerald-600",
    bar: "bg-emerald-500",
  },
  {
    name: "Task Mgmt",
    icon: ICON.clipboard,
    slug: "my-queue",
    tile: "bg-amber-50 text-amber-600",
    tileSolidHover: "group-hover:bg-amber-600 group-hover:text-white",
    tileTintHover: "group-hover:bg-amber-50 group-hover:text-amber-600",
    bar: "bg-amber-500",
  },
  {
    name: "Role Mgmt",
    icon: ICON.shield,
    tile: "bg-rose-50 text-rose-600",
    tileSolidHover: "group-hover:bg-rose-600 group-hover:text-white",
    tileTintHover: "group-hover:bg-rose-50 group-hover:text-rose-600",
    bar: "bg-rose-500",
  },
  {
    name: "Users and Settings",
    icon: ICON.users,
    slug: "settings",
    tile: "bg-teal-50 text-teal-600",
    tileSolidHover: "group-hover:bg-teal-600 group-hover:text-white",
    tileTintHover: "group-hover:bg-teal-50 group-hover:text-teal-600",
    bar: "bg-teal-500",
  },
  {
    name: "Pitch Perfect",
    icon: ICON.presentation,
    slug: "pitch-perfect",
    tile: "bg-fuchsia-50 text-fuchsia-600",
    tileSolidHover: "group-hover:bg-fuchsia-600 group-hover:text-white",
    tileTintHover: "group-hover:bg-fuchsia-50 group-hover:text-fuchsia-600",
    bar: "bg-fuchsia-500",
  },
];

/* ------------------------------------------------------------------ *
 * Release notes
 * ------------------------------------------------------------------ */

export type ChangeKind = "added" | "improved" | "fixed";

export const KIND_STYLE: Record<
  ChangeKind,
  { label: string; dot: string; chip: string; text: string }
> = {
  added: {
    label: "New",
    dot: "bg-emerald-500",
    chip: "bg-emerald-50 text-emerald-700",
    text: "text-emerald-700",
  },
  improved: {
    label: "Improved",
    dot: "bg-indigo-500",
    chip: "bg-indigo-50 text-indigo-700",
    text: "text-indigo-700",
  },
  fixed: {
    label: "Fixed",
    dot: "bg-amber-500",
    chip: "bg-amber-50 text-amber-700",
    text: "text-amber-700",
  },
};

export type Release = {
  version: string;
  date: string;
  current?: boolean;
  changes: { kind: ChangeKind; app: string; text: string }[];
};

export const RELEASES: Release[] = [
  {
    version: "4.8.0",
    date: "1 Aug 2026",
    current: true,
    changes: [
      {
        kind: "added",
        app: "Deposit Analytics",
        text: "Balance drift alerting on the top 50 relationships, with a daily digest.",
      },
      {
        kind: "improved",
        app: "Air Traffic Control",
        text: "Monitor grid now streams updates instead of polling on a 60s timer.",
      },
      {
        kind: "fixed",
        app: "Mgmt Report",
        text: "Month-end packs no longer double-count reversed entries.",
      },
    ],
  },
  {
    version: "4.7.2",
    date: "18 Jul 2026",
    changes: [
      {
        kind: "improved",
        app: "Client Profile",
        text: "Entity hierarchy loads lazily — first paint down from 2.4s to 380ms.",
      },
      {
        kind: "fixed",
        app: "Role Mgmt",
        text: "Inherited permissions were shown as direct grants in the audit export.",
      },
    ],
  },
  {
    version: "4.7.0",
    date: "30 Jun 2026",
    changes: [
      {
        kind: "added",
        app: "Pitch Perfect",
        text: "Opportunity workspace with AI readiness scoring on every section.",
      },
      {
        kind: "improved",
        app: "Task Mgmt",
        text: "Bulk reassign across queues, capped at 500 items per action.",
      },
    ],
  },
];

/* ------------------------------------------------------------------ *
 * Key contacts
 * ------------------------------------------------------------------ */

export type Contact = {
  name: string;
  role: string;
  email: string;
  /** Monogram tint, Cards layout. Sheet keeps monograms neutral. */
  tint: string;
};

export const CONTACT_GROUPS: { heading: string; people: Contact[] }[] = [
  {
    heading: "Product",
    people: [
      {
        name: "Priya Raman",
        role: "Head of Platform",
        email: "priya.raman@example.com",
        tint: "bg-indigo-50 text-indigo-700",
      },
      {
        name: "Tom Beckett",
        role: "Client & Entity apps",
        email: "tom.beckett@example.com",
        tint: "bg-violet-50 text-violet-700",
      },
      {
        name: "Anja Lindqvist",
        role: "Analytics & reporting",
        email: "anja.lindqvist@example.com",
        tint: "bg-emerald-50 text-emerald-700",
      },
    ],
  },
  {
    heading: "Support",
    people: [
      {
        name: "Service Desk",
        role: "Access, outages, incidents · 24/5",
        email: "servicedesk@example.com",
        tint: "bg-sky-50 text-sky-700",
      },
      {
        name: "Marcus Oyelaran",
        role: "Entitlements & role approvals",
        email: "marcus.oyelaran@example.com",
        tint: "bg-amber-50 text-amber-700",
      },
    ],
  },
];

export function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
