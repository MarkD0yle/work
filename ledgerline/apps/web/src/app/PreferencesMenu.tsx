import {
  Button,
  densities,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  themes,
  type DensityName,
  type Theme,
} from '@ledgerline/ui';
import { SlidersHorizontal } from 'lucide-react';

const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

interface PreferencesMenuProps {
  theme: Theme;
  density: DensityName;
  onTheme: (theme: Theme) => void;
  onDensity: (density: DensityName) => void;
}

export function PreferencesMenu({ theme, density, onTheme, onDensity }: PreferencesMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Display preferences">
          <SlidersHorizontal aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={(v) => onTheme(v as Theme)}>
          {themes.map((t) => (
            <DropdownMenuRadioItem key={t} value={t}>
              {title(t)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Density</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={density} onValueChange={(v) => onDensity(v as DensityName)}>
          {densities.map((d) => (
            <DropdownMenuRadioItem key={d} value={d}>
              {title(d)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
