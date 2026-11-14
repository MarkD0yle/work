import { NotificationProvider, TooltipProvider } from '@ledgerline/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { Shell } from './app/Shell';
import { flags } from './flags';
import './index.css';
import { DomainPlaceholder } from './routes/DomainPlaceholder';
import { Home } from './routes/Home';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

const router = createBrowserRouter([
  {
    path: '/',
    element: <Shell />,
    children: [
      { index: true, element: <Home /> },
      // Loaded on demand: the grid engine is large and not needed for first paint.
      {
        path: 'transactions',
        lazy: async () => ({ Component: (await import('./routes/Transactions')).Transactions }),
      },
      { path: ':domain', element: <DomainPlaceholder /> },
    ],
  },
]);

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root');

// Enterprise grid features switch on only when a licence key exists (SPEC §2, weakness 4).
const licence = import.meta.env.VITE_AG_GRID_LICENSE;
if (flags.agGridEnterprise && licence)
  await (await import('@ledgerline/ui/grid')).enableGridEnterprise(licence);

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <NotificationProvider>
          <RouterProvider router={router} />
        </NotificationProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>,
);
