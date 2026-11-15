import {
  applyDensity,
  applyTheme,
  Button,
  cn,
  CommandPalette,
  encodeViewDiff,
  isTypingTarget,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ShortcutSheet,
  useCommands,
  useCommandSource,
  type CommandItem,
  NotificationPanel,
  NotificationToggle,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@ledgerline/ui';
import { useQuery } from '@tanstack/react-query';
import { CircleHelp, Command, ListChecks, PanelLeftClose, PanelLeftOpen, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import {
  ApiError,
  fetchMe,
  fetchUsers,
  fetchWorkspaces,
  rememberEntity,
  searchEntities,
} from '../api/client';
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
  const navigate = useNavigate();
  const commands = useCommands();
  const workspaces = useQuery({
    queryKey: ['workspaces', userId],
    queryFn: fetchWorkspaces,
    enabled: Boolean(userId && me.data),
  });
  const isClient = me.data?.user.segment === 'client';

  // Navigation and workspaces in the command palette. Each domain also has a two-key shortcut: g, then a letter.
  useCommandSource('navigation', () => [
    ...domains.map((d) => ({
      id: `nav.${d.path}`,
      group: 'Navigation' as const,
      label: `Go to ${d.label}`,
      shortcut: `g ${d.key}`,
      run: () => void navigate(`/${d.path}`),
    })),
    {
      id: 'nav.profile',
      group: 'Navigation' as const,
      label: 'Go to My access',
      hint: 'What this user can do, and why not',
      run: () => void navigate('/profile'),
    },
    ...(workspaces.data ?? []).map((w) => ({
      id: `workspace.${w.id}`,
      group: 'Workspaces' as const,
      label: `Open workspace: ${w.name}`,
      hint: w.isTeamDefault ? 'Team default' : `Owned by ${w.owner.name}`,
      run: () => void navigate(`/w/${w.id}`),
    })),
  ]);

  // "g" then a letter jumps to a domain, from anywhere except while typing.
  useEffect(() => {
    let armed = 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
      const now = Date.now();
      if (e.key === 'g') {
        armed = now;
        return;
      }
      const target = now - armed < 1500 ? domains.find((d) => d.key === e.key) : undefined;
      armed = 0;
      if (target) {
        e.preventDefault();
        void navigate(`/${target.path}`);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  const findRecords = async (q: string): Promise<CommandItem[]> => {
    const [portfolios, securities] = await Promise.all([
      searchEntities('portfolio', q),
      searchEntities('security', q),
    ]);
    return [...portfolios, ...securities]
      .sort((a, b) => Number(Boolean(b.matchedOn)) - Number(Boolean(a.matchedOn)))
      .slice(0, 12)
      .map((r) => ({
        id: `${r.ref.kind}.${r.ref.id}`,
        group: 'Entities' as const,
        label: `${r.ref.id} ${r.description}`,
        hint: `Show transactions for this ${r.ref.kind}`,
        ...(r.restricted ? { disabledReason: r.restricted.reason } : {}),
        run: () => {
          void rememberEntity(r.ref);
          const d = encodeViewDiff({
            filters: [
              { field: r.ref.kind === 'portfolio' ? 'portfolioId' : 'securityId', op: 'eq', value: r.ref.id },
            ],
          });
          void navigate(`/transactions?view=V-transactions-default&d=${d}`, {
            state: { nonce: `${r.ref.id}-${Date.now()}` },
          });
        },
      }));
  };

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
        <Button
          variant="secondary"
          onClick={() => commands.setOpen(true)}
          aria-keyshortcuts="Control+K Meta+K"
        >
          <Command aria-hidden />
          Commands
          <kbd className="font-sans text-2xs text-muted-foreground">Ctrl+K</kbd>
        </Button>
        {userId && me.data ? <WorkspaceSwitcher userId={userId} /> : null}
        {isClient ? null : (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost">
                <ListChecks aria-hidden />
                Jobs
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" aria-label="Jobs">
              <p className="font-medium">No jobs yet</p>
              <p className="text-muted-foreground">
                Reports, exports, imports and large bulk actions will run here, so you can leave a screen and
                come back for the result.
              </p>
            </PopoverContent>
          </Popover>
        )}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Keyboard shortcuts"
          aria-keyshortcuts="?"
          onClick={() => commands.setSheetOpen(true)}
        >
          <CircleHelp aria-hidden />
        </Button>
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
      {/* External clients get navigation and views only: no actions, no record search (SPEC 8.6). */}
      <CommandPalette
        {...(isClient ? { groups: ['Navigation', 'Views'] } : { searchEntities: findRecords })}
      />
      <ShortcutSheet
        sections={[
          {
            title: 'Everywhere',
            entries: [
              { keys: 'Ctrl+K', what: 'Open the command palette' },
              { keys: '?', what: 'Show this list' },
              ...domains.map((d) => ({ keys: `g then ${d.key}`, what: `Go to ${d.label}` })),
            ],
          },
        ]}
      />
    </div>
  );
}
