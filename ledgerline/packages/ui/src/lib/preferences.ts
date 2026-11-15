import {
  defaultDensity,
  defaultTheme,
  densities,
  themes,
  type DensityName,
  type Theme,
} from '@ledgerline/tokens';

export type { DensityName, Theme };
export { densities, themes };

/** Theme and density are attributes on <html>, so tokens switch with no re-render. */
export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
  root.dataset.theme = theme;
}

export function applyDensity(density: DensityName, root: HTMLElement = document.documentElement): void {
  root.dataset.density = density;
}

export function currentTheme(root: HTMLElement = document.documentElement): Theme {
  const value = root.dataset.theme;
  return themes.find((t) => t === value) ?? defaultTheme;
}

export function currentDensity(root: HTMLElement = document.documentElement): DensityName {
  const value = root.dataset.density;
  return densities.find((d) => d === value) ?? defaultDensity;
}
