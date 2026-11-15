import type { AccessLevel, EntityRef, Message, User } from '@ledgerline/contracts';
import {
  Badge,
  Button,
  describeAction,
  EntityPicker,
  Label,
  SectionBanner,
  Select,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  toast,
} from '@ledgerline/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useCallback, useState } from 'react';
import {
  fetchAdminUsers,
  fetchUserPermissions,
  problemOf,
  searchEntities,
  updateAdminUser,
  updateUserPermissions,
  type Me,
} from '../services';
import { ErrorPanel, LoadingPanel } from '../state-panels';
import { RecordHistory } from '../transactions/RecordHistory';

const LEVELS: { value: AccessLevel; label: string }[] = [
  { value: 'none', label: 'No access' },
  { value: 'view', label: 'View' },
  { value: 'edit', label: 'Edit' },
  { value: 'full', label: 'Full' },
];
const DENSITIES = ['compact', 'standard', 'comfortable'] as const;
/** "transaction.reverse" reads "Reverse" inside its group; the full id stays beside it for support. */
const actionName = (action: string) => describeAction(action.split('.').slice(1).join('.') || action);

/**
 * Admin (SPEC 9): each user's access level per action, grouped, and their blotter scope.
 * Changes are staged and shown as a count until saved. Every saved change is audited.
 */
export function AdminConsole({ me }: { me: Me }) {
  const users = useQuery({ queryKey: ['admin-users'], queryFn: fetchAdminUsers });
  const [selected, setSelected] = useState<string | null>(null);
  if (users.isPending) return <LoadingPanel label="Loading users…" />;
  if (users.error) {
    const found = problemOf(users.error);
    // Not being an administrator is a stated restriction, not a fault.
    if (found?.status === 403)
      return (
        <SectionBanner
          className="max-w-xl"
          state={{
            kind: 'permissionLimited',
            reason: found.messages[0]?.text ?? 'User administration is limited to administrators.',
          }}
        />
      );
    return <ErrorPanel messages={found?.messages ?? []} onRetry={() => void users.refetch()} />;
  }
  const user = users.data.find((u) => u.id === selected);
  return (
    <div className="flex h-full min-h-0 gap-4">
      <div className="w-96 shrink-0 overflow-auto rounded-md border">
        <table aria-label="Users" className="w-full text-body">
          <thead className="sticky top-0 bg-muted text-left text-xs">
            <tr>
              <th scope="col" className="px-3 py-1.5 font-medium">
                User
              </th>
              <th scope="col" className="px-3 py-1.5 font-medium">
                Scope
              </th>
            </tr>
          </thead>
          <tbody>
            {users.data.map((u) => (
              <tr key={u.id} className={`border-t ${u.id === selected ? 'bg-accent' : ''}`}>
                <th scope="row" className="px-3 py-1.5 text-left font-normal">
                  <button
                    type="button"
                    className="text-left"
                    aria-pressed={u.id === selected}
                    onClick={() => setSelected(u.id)}
                  >
                    <span className="font-medium underline-offset-2 hover:underline">{u.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {u.role} · {u.team}
                    </span>
                  </button>
                </th>
                <td className="px-3 py-1.5 text-xs">
                  {u.blotterScope?.length
                    ? `${u.blotterScope.length} ${u.blotterScope.length === 1 ? 'portfolio' : 'portfolios'}`
                    : 'Every portfolio'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="min-w-0 flex-1">
        {user ? (
          <UserEditor key={user.id} user={user} me={me} />
        ) : (
          <p className="p-6 text-muted-foreground">Choose a user to see and change their access.</p>
        )}
      </div>
    </div>
  );
}

function UserEditor({ user, me }: { user: User; me: Me }) {
  const queryClient = useQueryClient();
  const permissions = useQuery({
    queryKey: ['admin-permissions', user.id],
    queryFn: () => fetchUserPermissions(user.id),
  });
  /** Staged changes. Nothing is saved until Save. */
  const [levels, setLevels] = useState<Record<string, AccessLevel>>({});
  const [scope, setScope] = useState<string[] | null>(null);
  const [density, setDensity] = useState<User['defaultDensity'] | null>(null);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<Message[] | null>(null);
  const [saving, setSaving] = useState(false);
  const search = useCallback(
    (q: string, o: { includeInactive: boolean }) => searchEntities('portfolio', q, o),
    [],
  );

  if (permissions.isPending) return <LoadingPanel label="Loading access…" />;
  if (permissions.error)
    return (
      <ErrorPanel
        messages={problemOf(permissions.error)?.messages ?? []}
        onRetry={() => void permissions.refetch()}
      />
    );

  const current = permissions.data;
  const saved = user.blotterScope ?? [];
  const nowScope = scope ?? saved;
  const changes = current
    .filter((p) => levels[p.action] !== undefined && levels[p.action] !== p.accessLevel)
    .map((p) => ({ action: p.action, accessLevel: levels[p.action] as AccessLevel }));
  const scopeChanged =
    scope !== null && JSON.stringify([...scope].sort()) !== JSON.stringify([...saved].sort());
  const densityChanged = density !== null && density !== user.defaultDensity;
  const pending = changes.length + (scopeChanged ? 1 : 0) + (densityChanged ? 1 : 0);
  const groups = [...new Set(current.map((p) => p.group ?? 'Other'))];
  const stage = (action: string, level: AccessLevel) => {
    setFailure(null);
    setLevels((prev) => ({ ...prev, [action]: level }));
  };
  const discard = () => {
    setLevels({});
    setScope(null);
    setDensity(null);
    setFailure(null);
  };
  const save = async () => {
    setSaving(true);
    setFailure(null);
    try {
      if (changes.length)
        queryClient.setQueryData(
          ['admin-permissions', user.id],
          await updateUserPermissions(user.id, changes),
        );
      if (scopeChanged || densityChanged)
        await updateAdminUser(user.id, {
          ...(scopeChanged ? { blotterScope: nowScope } : {}),
          ...(densityChanged && density ? { defaultDensity: density } : {}),
        });
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      await queryClient.invalidateQueries({ queryKey: ['audit', me.user.id, 'user', user.id] });
      discard();
      toast('Saved', `${pending} ${pending === 1 ? 'change' : 'changes'} for ${user.name}`);
    } catch (error) {
      // A refusal (for example removing your own administrator access) stays on screen.
      setFailure(problemOf(error)?.messages ?? []);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      aria-label={`Access for ${user.name}`}
      data-slot="user-editor"
      className="flex h-full min-h-0 flex-col rounded-md border"
    >
      <header className="flex shrink-0 items-center gap-3 border-b px-4 py-2">
        <h2 className="font-semibold">{user.name}</h2>
        <span className="text-muted-foreground">
          {user.role} · {user.team}
        </span>
        {user.id === me.user.id ? <Badge status="info">This is you</Badge> : null}
      </header>
      <Tabs defaultValue="access" className="flex-1">
        <TabsList aria-label="User sections">
          <TabsTrigger value="access">Access</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="access" className="flex flex-col gap-4 overflow-y-auto p-4">
          {failure?.length ? <SectionBanner state={{ kind: 'blockingError', messages: failure }} /> : null}

          <section aria-label="Blotter scope" className="flex flex-col gap-2">
            <h3 className="font-semibold">Blotter scope</h3>
            <p className="text-muted-foreground">
              {nowScope.length
                ? `${user.name} sees only these portfolios, in every list and report.`
                : `${user.name} sees every portfolio. Add one to limit what they see.`}
            </p>
            {nowScope.length ? (
              <ul className="flex flex-wrap gap-1.5" aria-label="Portfolios in scope">
                {nowScope.map((id) => (
                  <li
                    key={id}
                    className="flex items-center gap-1 rounded-md border bg-muted py-0.5 pr-1 pl-2"
                  >
                    <span>
                      {labels[id] ? `${labels[id]} ` : ''}
                      <span className="font-mono text-xs">{id}</span>
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${id} from scope`}
                      onClick={() => setScope(nowScope.filter((p) => p !== id))}
                    >
                      <X aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
            <EntityPicker
              label="Add a portfolio to the scope"
              className="w-96"
              value={null}
              clearOnSelect
              search={search}
              placeholder="Search portfolios"
              onChange={(value: EntityRef | null) => {
                if (!value || nowScope.includes(value.id)) return;
                setLabels((prev) => ({ ...prev, [value.id]: value.label }));
                setScope([...nowScope, value.id]);
              }}
            />
          </section>

          <section aria-label="Display" className="flex flex-col gap-1">
            <Label htmlFor={`density-${user.id}`}>Default density</Label>
            <Select
              id={`density-${user.id}`}
              className="w-48"
              value={density ?? user.defaultDensity}
              onChange={(e) => setDensity(e.target.value as User['defaultDensity'])}
            >
              {DENSITIES.map((d) => (
                <option key={d} value={d}>
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </option>
              ))}
            </Select>
          </section>

          {groups.map((group) => {
            const actions = current.filter((p) => (p.group ?? 'Other') === group);
            return (
              <section
                key={group}
                aria-label={`${group} permissions`}
                data-group={group}
                className="rounded-md border"
              >
                <header className="flex items-center gap-3 border-b bg-muted px-3 py-1.5">
                  <h3 className="mr-auto font-semibold">{group}</h3>
                  <Label htmlFor={`group-${user.id}-${group}`} className="font-normal text-muted-foreground">
                    Set all {actions.length} to
                  </Label>
                  <Select
                    id={`group-${user.id}-${group}`}
                    className="w-36"
                    value=""
                    onChange={(e) => {
                      if (!e.target.value) return;
                      setFailure(null);
                      setLevels((prev) => ({
                        ...prev,
                        ...Object.fromEntries(actions.map((p) => [p.action, e.target.value as AccessLevel])),
                      }));
                    }}
                  >
                    <option value="">Choose…</option>
                    {LEVELS.map((l) => (
                      <option key={l.value} value={l.value}>
                        {l.label}
                      </option>
                    ))}
                  </Select>
                </header>
                <ul>
                  {actions.map((p) => {
                    const level = levels[p.action] ?? p.accessLevel;
                    const changed = level !== p.accessLevel;
                    return (
                      <li
                        key={p.action}
                        className="flex items-center gap-3 border-b px-3 py-1 last:border-b-0"
                      >
                        <span className="min-w-0 flex-1">
                          <label htmlFor={`level-${user.id}-${p.action}`}>{actionName(p.action)}</label>{' '}
                          <span className="font-mono text-2xs text-muted-foreground">{p.action}</span>
                          {changed ? (
                            <span className="ml-2 text-xs text-info">Changed, not saved yet</span>
                          ) : null}
                        </span>
                        <Select
                          id={`level-${user.id}-${p.action}`}
                          className="w-36"
                          value={level}
                          onChange={(e) => stage(p.action, e.target.value as AccessLevel)}
                        >
                          {LEVELS.map((l) => (
                            <option key={l.value} value={l.value}>
                              {l.label}
                            </option>
                          ))}
                        </Select>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </TabsContent>
        <TabsContent value="history" className="overflow-y-auto">
          <RecordHistory recordType="user" recordId={user.id} userId={me.user.id} noun="user" />
        </TabsContent>
      </Tabs>
      <footer className="flex shrink-0 items-center gap-2 border-t p-3">
        <Button disabled={pending === 0 || saving} onClick={() => void save()}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button variant="ghost" disabled={pending === 0 || saving} onClick={discard}>
          Discard changes
        </Button>
        <span className="ml-auto text-xs text-muted-foreground" role="status" data-slot="pending-count">
          {pending ? `${pending} unsaved ${pending === 1 ? 'change' : 'changes'}` : 'No unsaved changes'}
        </span>
      </footer>
    </section>
  );
}
