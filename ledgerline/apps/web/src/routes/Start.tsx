import { Navigate, useOutletContext } from 'react-router';
import type { Me } from '../api/client';

/**
 * Where sign-in lands. A workspace marked "open at sign-in" opens with all its panels (SPEC 7.2);
 * the user's own comes before their team's default. Users with none land on their access page.
 */
export function Start() {
  const { startupWorkspaces, user } = useOutletContext<Me>();
  // An external client lands on their own home page: positions, transactions and statements (SPEC 8.6).
  if (user.segment === 'client') return <Navigate to="/home" replace />;
  const first = startupWorkspaces[0];
  return <Navigate to={first ? `/w/${first.id}` : '/profile'} replace />;
}
