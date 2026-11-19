import type { User } from '@ledgerline/contracts';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@ledgerline/ui';
import { ChevronDown, UserRound } from 'lucide-react';

interface RoleSwitcherProps {
  users: User[];
  currentId: string | null;
  onChange: (userId: string) => void;
}

/** Dev-mode sign-in: picks which seeded user the API sees (X-LL-User). */
export function RoleSwitcher({ users, currentId, onChange }: RoleSwitcherProps) {
  const current = users.find((u) => u.id === currentId);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost">
          <UserRound aria-hidden />
          <span className="sr-only">Switch user. Signed in as</span>
          <span>{current ? `${current.name} · ${current.role}` : 'nobody yet'}</span>
          <ChevronDown aria-hidden className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-64">
        <DropdownMenuLabel>Sign in as (dev)</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={currentId ?? ''} onValueChange={onChange}>
          {users.map((u) => (
            <DropdownMenuRadioItem key={u.id} value={u.id}>
              <span className="font-medium">{u.name}</span>
              <span className="ml-auto pl-4 text-muted-foreground">
                {u.role} · {u.team}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
