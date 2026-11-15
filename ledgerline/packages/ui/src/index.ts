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

export { Input, Label, Textarea } from './components/input';
export { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from './components/popover';
export { useDensity } from './lib/use-density';

// Financial fields and cells (SPEC 7.5)
export { FinancialCell, type FinancialCellProps } from './financial/financial-cell';
export { FinancialInput, type FinancialInputProps } from './financial/financial-input';
export { formatFinancial, rawFinancial, type FormattedFinancial } from './financial/format';
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

// The data grid (SPEC 7.1) is a separate entry, `@ledgerline/ui/grid`, so screens without a grid do not load the grid engine.
