import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@ledgerline/ui';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, PanelsTopLeft } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import { fetchWorkspaces } from '../api/client';

/** Lists the user's workspaces and their team defaults. A new user never sees an empty list. */
export function WorkspaceSwitcher({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const { workspaceId } = useParams();
  const workspaces = useQuery({ queryKey: ['workspaces', userId], queryFn: fetchWorkspaces });
  const current = workspaces.data?.find((w) => w.id === workspaceId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost">
          <PanelsTopLeft aria-hidden />
          <span className="sr-only">Workspace:</span>{' '}
          <span className="max-w-48 truncate">{current?.name ?? 'Workspaces'}</span>
          <ChevronDown aria-hidden className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-64">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        {workspaces.isPending ? <DropdownMenuItem disabled>Loading…</DropdownMenuItem> : null}
        {workspaces.error ? (
          <DropdownMenuItem disabled>Workspaces could not be loaded.</DropdownMenuItem>
        ) : null}
        {workspaces.data?.length === 0 ? (
          <DropdownMenuItem disabled>No workspaces yet for your team.</DropdownMenuItem>
        ) : null}
        {workspaces.data?.map((w) => (
          <DropdownMenuItem key={w.id} onSelect={() => void navigate(`/w/${w.id}`)}>
            <span className={w.id === workspaceId ? 'font-semibold' : undefined}>{w.name}</span>
            <span className="ml-auto pl-4 text-2xs text-muted-foreground">
              {w.isTeamDefault ? 'Team default' : w.owner.id === userId ? 'Yours' : w.owner.name}
              {w.loadAtStartup ? ' · at sign-in' : ''}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
