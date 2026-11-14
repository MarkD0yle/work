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
export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './components/tooltip';
