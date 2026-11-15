import {
  ArrowLeftRight,
  Banknote,
  BookOpen,
  Briefcase,
  FileText,
  Landmark,
  LineChart,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export interface Domain {
  path: string;
  label: string;
  icon: LucideIcon;
  /** Milestone in docs/PLAN.md that delivers the first journey in this domain. */
  milestone: number;
  /** Second key of the `g` shortcut: `g t` goes to Transactions. */
  key: string;
}

/** Left-rail domains (SPEC §6). */
export const domains: Domain[] = [
  { path: 'portfolios', label: 'Portfolios', icon: Briefcase, milestone: 2, key: 'p' },
  { path: 'securities', label: 'Securities', icon: Landmark, milestone: 2, key: 's' },
  { path: 'transactions', label: 'Transactions', icon: ArrowLeftRight, milestone: 1, key: 't' },
  { path: 'market-data', label: 'Market Data', icon: LineChart, milestone: 6, key: 'm' },
  { path: 'cash', label: 'Cash', icon: Banknote, milestone: 6, key: 'c' },
  { path: 'accounting', label: 'Accounting', icon: BookOpen, milestone: 6, key: 'a' },
  { path: 'reports', label: 'Reports', icon: FileText, milestone: 5, key: 'r' },
  { path: 'admin', label: 'Admin', icon: Settings, milestone: 7, key: 'd' },
];
