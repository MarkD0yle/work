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
}

/** Left-rail domains (SPEC §6). */
export const domains: Domain[] = [
  { path: 'portfolios', label: 'Portfolios', icon: Briefcase, milestone: 2 },
  { path: 'securities', label: 'Securities', icon: Landmark, milestone: 2 },
  { path: 'transactions', label: 'Transactions', icon: ArrowLeftRight, milestone: 1 },
  { path: 'market-data', label: 'Market Data', icon: LineChart, milestone: 6 },
  { path: 'cash', label: 'Cash', icon: Banknote, milestone: 6 },
  { path: 'accounting', label: 'Accounting', icon: BookOpen, milestone: 6 },
  { path: 'reports', label: 'Reports', icon: FileText, milestone: 5 },
  { path: 'admin', label: 'Admin', icon: Settings, milestone: 7 },
];
