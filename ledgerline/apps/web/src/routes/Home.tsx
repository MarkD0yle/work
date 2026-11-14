import type { Permission } from '@ledgerline/contracts';
import { Badge } from '@ledgerline/ui';
import { useQuery } from '@tanstack/react-query';
import { useOutletContext } from 'react-router';
import { ApiError, fetchPermissions, type Me } from '../api/client';
import { ErrorPanel, LoadingPanel } from '../app/StatePanel';

function groupBy(permissions: Permission[]): [string, Permission[]][] {
  const groups = new Map<string, Permission[]>();
  for (const p of permissions) {
    const key = p.group ?? 'Other';
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  return [...groups];
}

export function Home() {
  const { user, startupWorkspaces } = useOutletContext<Me>();
  const permissions = useQuery({ queryKey: ['permissions', user.id], queryFn: fetchPermissions });

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Signed in as {user.name}</h1>
        <p className="text-muted-foreground">
          {user.role} · {user.team} · default density {user.defaultDensity}
          {user.blotterScope ? ` · limited to ${user.blotterScope.join(', ')}` : ''}
        </p>
        {startupWorkspaces.length ? (
          <p className="mt-1 text-muted-foreground">
            Startup workspace: {startupWorkspaces.map((w) => w.name).join(', ')} (arrives in Milestone 2)
          </p>
        ) : null}
      </header>

      <section aria-labelledby="permissions-heading">
        <h2 id="permissions-heading" className="mb-2 text-lg font-semibold">
          What this user can do
        </h2>
        {permissions.isPending ? (
          <LoadingPanel label="Loading permissions…" />
        ) : permissions.error ? (
          <ErrorPanel
            messages={permissions.error instanceof ApiError ? permissions.error.messages : []}
            onRetry={() => void permissions.refetch()}
          />
        ) : (
          <div className="overflow-hidden rounded-md border bg-card">
            <table className="w-full border-collapse text-left">
              <thead className="bg-muted text-xs text-muted-foreground">
                <tr className="h-(--ll-row-height)">
                  <th scope="col" className="px-(--ll-padding-x) font-medium">
                    Action
                  </th>
                  <th scope="col" className="px-(--ll-padding-x) font-medium">
                    Access
                  </th>
                  <th scope="col" className="px-(--ll-padding-x) font-medium">
                    Why not
                  </th>
                </tr>
              </thead>
              {groupBy(permissions.data).map(([group, rows]) => (
                <tbody key={group}>
                  <tr className="h-(--ll-row-height) border-t bg-muted/50">
                    <th scope="colgroup" colSpan={3} className="px-(--ll-padding-x) text-xs font-semibold">
                      {group}
                    </th>
                  </tr>
                  {rows.map((p) => (
                    <tr key={p.action} className="h-(--ll-row-height) border-t">
                      <th scope="row" className="px-(--ll-padding-x) font-mono text-xs font-normal">
                        {p.action}
                      </th>
                      <td className="px-(--ll-padding-x)">
                        <Badge status={p.allowed ? 'good' : 'neutral'}>
                          {p.allowed ? p.accessLevel : 'not allowed'}
                        </Badge>
                      </td>
                      <td className="px-(--ll-padding-x) text-muted-foreground">{p.explanation ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
