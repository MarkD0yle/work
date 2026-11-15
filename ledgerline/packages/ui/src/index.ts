/**
 * @ledgerline/ui
 * shadcn/ui components (Radix + Tailwind) themed by @ledgerline/tokens.
 * Apps import primitives from here only, never from Radix directly.
 */
export { cn } from './lib/cn';
export {
  applyDensity,
  applyTheme,
  currentDensity,
  currentTheme,
  densities,
  themes,
  type DensityName,
  type Theme,
} from './lib/preferences';

export { Badge, type BadgeProps } from './components/badge';
export { Button, type ButtonProps } from './components/button';
export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './components/dropdown-menu';
export { Separator } from './components/separator';
export { toast, Toaster } from './components/toaster';
export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './components/tooltip';

export { Input, Select, Label, Textarea } from './components/input';
export { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from './components/popover';
export { useDensity } from './lib/use-density';

// Financial fields and cells (SPEC 7.5)
export { FinancialCell, type FinancialCellProps } from './financial/financial-cell';
export { FinancialInput, type FinancialInputProps } from './financial/financial-input';
export { formatDelta, type FormattedDelta, type ToleranceLevel } from './financial/delta';
export {
  formatFinancial,
  formatPercent,
  fractionToPercent,
  percentToFraction,
  rawFinancial,
  type FormattedFinancial,
} from './financial/format';
export { parseFinancialInput, type ParseResult } from './financial/parse';
export { displayPrecision, minorUnits, registryPrecision, storagePrecision } from './financial/registry';

// State and validation (SPEC 7.7)
export { describeState, type StateDescription, type Tone } from './state/describe';
export { FieldMessage, type FieldMessageProps } from './state/field-message';
export { MessageList, MessageText } from './state/message-list';
export {
  NotificationPanel,
  NotificationProvider,
  NotificationToggle,
  useNotifications,
  type NotificationItem,
  type TargetResolver,
} from './state/notifications';
export { RowMarker, type RowMarkerProps } from './state/row-marker';
export { SectionBanner, type SectionBannerProps } from './state/section-banner';
export { StateOverlay, type StateOverlayProps } from './state/state-overlay';

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from './components/dialog';

// Date and period fields (SPEC 7.6)
export { normaliseApiDate } from './dates/api-boundary';
export { BusinessDateInput, type BusinessDateInputProps } from './dates/business-date-input';
export {
  addBusinessDays,
  addDays,
  addMonths,
  adjustToBusinessDay,
  endOfMonth,
  isBusinessDay,
  type BusinessDayRule,
} from './dates/calendar';
export {
  BASIS_LABELS,
  formatBusinessDate,
  formatIsoDate,
  formatIsoDateLong,
  formatPeriod,
} from './dates/format';
export { parseDateInput, type DateParseResult } from './dates/parse';
export { PeriodPicker, type PeriodPickerProps } from './dates/period-picker';

// Saved views (SPEC 7.2)
export { TaskChips, type TaskChip, type TaskChipsProps } from './views/task-chips';
export { ViewSelector, type ViewSelectorProps } from './views/view-selector';
export {
  applyViewDiff,
  countConditions,
  decodeViewDiff,
  defaultViewState,
  diffView,
  encodeViewDiff,
  migrateView,
  normaliseView,
  startingView,
  viewsEqual,
  type MigratedView,
  type ViewDiff,
  type ViewSchema,
  type ViewState,
} from './views/view-state';

// Entity Picker (SPEC 7.3)
export { EntityOptionContent } from './picker/entity-option';
export { EntityPicker, type EntityPickerProps } from './picker/entity-picker';
export {
  EntityPickerSheet,
  type EntityCriteria,
  type EntityPickerSheetProps,
} from './picker/entity-picker-sheet';
export { detectIdentifier, shouldSearch, type IdentifierKind } from './picker/identify';

// Action registry (SPEC 7.8)
export { ActionBar, ActionLabel, ActionMenuItems, type ActionBarProps } from './actions/action-bar';
export { BulkResultPanel, bulkResultCsv, type BulkResultPanelProps } from './actions/bulk-results';
export {
  ConfirmDialog,
  confirmPhrase,
  TYPED_CONFIRM_ROWS,
  type ConfirmDialogProps,
  type Noun,
} from './actions/confirm-dialog';
export {
  formatShortcut,
  groupIneligible,
  layoutActions,
  matchesShortcut,
  resolveAction,
  resolveActions,
  validateRegistry,
  type ResolvedAction,
} from './actions/registry';
export { useActionRunner, type ActionOutcome } from './actions/use-action-runner';

// Command palette and shortcut sheet (SPEC 6)
export {
  CommandProvider,
  isTypingTarget,
  useCommands,
  useCommandSource,
  type CommandGroup,
  type CommandItem,
  type ShortcutEntry,
} from './command/command-context';
export { CommandPalette, matchCommands, type CommandPaletteProps } from './command/command-palette';
export { GRID_SHORTCUTS, ShortcutSheet, type ShortcutSection } from './command/shortcut-sheet';
export {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from './components/context-menu';

// The data grid (SPEC 7.1) is a separate entry, `@ledgerline/ui/grid`, so screens without a grid do not load the grid engine.
export {
  BatchGrid,
  type BatchColumn,
  type BatchEdit,
  type BatchGridProps,
  type BatchRow,
} from './batch/batch-grid';
export { parseDelimited } from './batch/tabular';
export { readXlsx } from './batch/xlsx';
export { Tabs, TabsContent, TabsList, TabsTrigger } from './components/tabs';
export {
  GLOSSARY,
  GlossaryProvider,
  GlossaryTerm,
  GlossaryText,
  type GlossaryProviderProps,
} from './glossary/glossary';
export { formatTimestamp } from './financial/provenance';
export { ComparisonTable, type ComparisonTableProps, type DeltaMode } from './comparison/comparison';
export {
  ActorLabel,
  AuditTimeline,
  auditChanges,
  describeAction,
  type AuditTimelineProps,
} from './audit/audit-timeline';
