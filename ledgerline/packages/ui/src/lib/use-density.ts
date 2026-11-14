import { useSyncExternalStore } from 'react';
import { currentDensity, type DensityName } from './preferences';

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-density'] });
  return () => observer.disconnect();
}

/** The active density, read from `data-density` on <html> and kept in step when it changes. */
export function useDensity(): DensityName {
  return useSyncExternalStore(subscribe, currentDensity, () => 'standard' as const);
}
