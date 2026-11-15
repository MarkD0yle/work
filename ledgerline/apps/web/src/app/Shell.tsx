import {
  applyDensity,
  applyTheme,
  Button,
  cn,
  NotificationPanel,
  NotificationToggle,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@ledgerline/ui';
import { useQuery } from '@tanstack/react-query';
import { PanelLeftClose, PanelLeftOpen, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import { ApiError, fetchMe, fetchUsers } from '../api/client';
import { useSession } from '../state/session';
import { domains } from './domains';
import { GlobalSearch } from './GlobalSearch';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { PreferencesMenu } from './PreferencesMenu';
import { RoleSwitcher } from './RoleSwitcher';
import { ErrorPanel, LoadingPanel } from './StatePanel';

export function Shell() {
  const { userId, theme, density, railCollapsed, setUser, setTheme, setDensity, toggleRail } = useSession();
  const users = useQuery({ queryKey: ['users'], queryFn: fetchUsers });
  const me = useQuery({ queryKey: ['me', userId], queryFn: fetchMe, enabled: Boolean(userId) });

  // First visit, or a stored user that no longer exists after a reseed: sign in as the first user.
  useEffect(() => {
    const first = users.data?.[0];
    if (first && !users.data?.some((u) => u.id === userId)) setUser(first.id);
  }, [users.data, userId, setUser]);

  const effectiveDensity = density ?? me.data?.user.defaultDensity ?? 'standard';
  useEffect(() => applyTheme(theme), [theme]);
  useEffect(() => applyDensity(effectiveDensity), [effectiveDensity]);

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const failed = users.error ?? me.error;

  return (
    <div className="flex h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-1 focus:left-1 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-1"
      >
        Skip to content
      </a>
      <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-card px-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={railCollapsed ? 'Expand navigation' : 'Collapse navigation'}
              aria-expanded={!railCollapsed}
              aria-controls="rail"
              onClick={toggleRail}
            >
              {railCollapsed ? <PanelLeftOpen aria-hidden /> : <PanelLeftClose aria-hidden />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{railCollapsed ? 'Expand navigation' : 'Collapse navigation'}</TooltipContent>
        </Tooltip>
        <NavLink to="/" className="text-lg font-semibold tracking-tight">
          Ledgerline
        </NavLink>
        <div className="flex-1" />
        {me.data ? <GlobalSearch /> : null}
        {userId && me.data ? <WorkspaceSwitcher userId={userId} /> : null}
        <NotificationToggle open={notificationsOpen} onToggle={() => setNotificationsOpen((open) => !open)} />
        <RoleSwitcher users={users.data ?? []} currentId={userId} onChange={setUser} />
        <PreferencesMenu theme={theme} density={effectiveDensity} onTheme={setTheme} onDensity={setDensity} />
      </header>
      <div className="flex min-h-0 flex-1">
        <nav
          id="rail"
          aria-label="Domains"
          className={cn('shrink-0 overflow-y-auto border-r bg-card p-2', railCollapsed ? 'w-12' : 'w-52')}
        >
          <ul className="flex flex-col gap-0.5">
            {domains.map(({ path, label, icon: Icon }) => (
              <li key={path}>
                <NavLink
                  to={`/${path}`}
                  aria-label={label}
                  title={railCollapsed ? label : undefined}
                  className={({ isActive }) =>
                    cn(
                      'flex h-(--ll-control-height) items-center gap-2 rounded-md px-2 text-foreground hover:bg-accent',
                      railCollapsed && 'justify-center px-0',
                      isActive && 'bg-accent font-medium shadow-[inset_2px_0_0_var(--ll-accent)]',
                    )
                  }
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  {railCollapsed ? null : <span>{label}</span>}
                </NavLink>
              </li>
            ))}
            <li className="mt-2 border-t pt-2">
              <NavLink
                to="/profile"
                aria-label="My access"
                title={railCollapsed ? 'My access' : undefined}
                className={({ isActive }) =>
                  cn(
                    'flex h-(--ll-control-height) items-center gap-2 rounded-md px-2 text-foreground hover:bg-accent',
                    railCollapsed && 'justify-center px-0',
                    isActive && 'bg-accent font-medium shadow-[inset_2px_0_0_var(--ll-accent)]',
                  )
                }
              >
                <ShieldCheck className="size-4 shrink-0" aria-hidden />
                {railCollapsed ? null : <span>My access</span>}
              </NavLink>
            </li>
          </ul>
        </nav>
        {/* Focusable so keyboard users can scroll it (WCAG 2.1.1). */}
        <main id="main" tabIndex={0} className="min-w-0 flex-1 overflow-auto focus-visible:-outline-offset-2">
          {failed ? (
            <ErrorPanel
              messages={failed instanceof ApiError ? failed.messages : []}
              onRetry={() => {
                void users.refetch();
                void me.refetch();
              }}
            />
          ) : !me.data ? (
            <LoadingPanel label="Signing in…" />
          ) : (
            <Outlet context={me.data} />
          )}
        </main>
        <NotificationPanel open={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
      </div>
    </div>
  );
}
