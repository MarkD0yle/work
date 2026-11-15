import type { DensityName, Theme } from '@ledgerline/ui';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SessionState {
  /** Dev role switcher: sent as X-LL-User on every API call. */
  userId: string | null;
  theme: Theme;
  /** Null means "use the signed-in user's default density". */
  density: DensityName | null;
  railCollapsed: boolean;
  setUser: (userId: string) => void;
  setTheme: (theme: Theme) => void;
  setDensity: (density: DensityName | null) => void;
  toggleRail: () => void;
}

/** UI state only. Server data lives in TanStack Query. */
export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      userId: null,
      theme: 'light',
      density: null,
      railCollapsed: false,
      // Switching user drops any density override so the new role's default applies.
      setUser: (userId) => set({ userId, density: null }),
      setTheme: (theme) => set({ theme }),
      setDensity: (density) => set({ density }),
      toggleRail: () => set((s) => ({ railCollapsed: !s.railCollapsed })),
    }),
    { name: 'll-session' },
  ),
);
