import { Badge } from '@ledgerline/ui';
import { useParams } from 'react-router';
import { domains } from '../app/domains';

export function DomainPlaceholder() {
  const { domain } = useParams();
  const match = domains.find((d) => d.path === domain);
  if (!match) {
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold tracking-tight">Page not found</h1>
        <p className="text-muted-foreground">
          There is no “{domain}” area. Choose a domain from the navigation.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 p-6">
      <h1 className="text-lg font-semibold tracking-tight">{match.label}</h1>
      <Badge status="info">Not built yet</Badge>
      <p className="max-w-prose text-muted-foreground">
        This area is a placeholder. Its first journey arrives in Milestone {match.milestone} of docs/PLAN.md.
      </p>
    </div>
  );
}
