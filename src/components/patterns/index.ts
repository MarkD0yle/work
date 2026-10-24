/* Pattern library — import every shared pattern from here.
 *
 *   import { PageHeader, MetricCard, DataTable } from "../components/patterns";
 *
 * Inventory, usage rules and the screens each pattern came from:
 * docs/patterns/README.md. Live examples: the "Pattern Library" page. */

export * as tokens from "./tokens";
export type { Tone } from "./tokens";

// Page structure
export { PageHeader } from "./PageHeader";
export { SectionCard } from "./SectionCard";
export { SplitView } from "./SplitView";

// Numbers
export { MetricCard, MetricGrid, DeltaText, type Delta } from "./MetricCard";
export { Sparkline } from "./Sparkline";
export { ProgressBar, BulletBar } from "./ProgressBar";

// State
export { StatusBadge } from "./StatusBadge";
export { StatusStrip, type Stage } from "./StatusStrip";
export { Banner, BannerStack } from "./Banner";
export { EmptyState } from "./EmptyState";

// Controls
export { SegmentedControl, Tabs, type Option } from "./SegmentedControl";
export { FilterBar, FilterSelect, ChipToggle } from "./FilterBar";
export { FacetRail, type Facet, type FacetOption } from "./FacetRail";

// Tables and lists
export { TableToolbar, ExportButton, type BulkAction } from "./TableToolbar";
export { DataTable, type Column } from "./DataTable";
export { default as MonitorGrid } from "./MonitorGrid";
export { RankedList, type RankedItem } from "./RankedList";
export { Timeline, type TimelineEvent } from "./Timeline";
export { KeyValueGrid, type KeyValue } from "./KeyValueGrid";

// Visuals
export { ChartGrid, ChartSpan, Legend } from "./ChartGrid";
export { Heatmap } from "./Heatmap";
export { heatClass } from "./heat";
export { InsightCard } from "./InsightCard";

// Side panels
export { default as ContextPanel, PanelSection, PanelMetaGrid } from "./ContextPanel";
export { PanelHost, type PanelWidth } from "./PanelHost";
export { EditPanel, PanelInput, PanelSelect } from "./EditPanel";
export { PanelTrail } from "./PanelStack";
export { usePanelStack, type StackItem } from "./usePanelStack";
export { ComparePanel, COMPARE_MAX, type CompareItem, type CompareField } from "./ComparePanel";
export { CommentThread, type Comment } from "./CommentThread";
export { HelpPanel, type HelpTopic } from "./HelpPanel";
export { useFieldHelp } from "./useFieldHelp";

// Overlays
export { default as Modal, ConfirmDialog } from "./Modal";
export { CommandPalette, type Command } from "./CommandPalette";
export { useCommandShortcut } from "./useCommandShortcut";

// Feedback
export { ToastProvider } from "./Toast";
export { useToast, type ToastOptions } from "./useToast";
export { SkeletonBlock, SkeletonLine, SkeletonTable, SkeletonCard, SkeletonPanel } from "./Skeleton";
