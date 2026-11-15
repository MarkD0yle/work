// Order matters: Node globals first, then the in-page API, then the unchanged web app.
import './polyfills';
import { boot } from './boot';

try {
  await boot();
  await import('../../web/src/main');
} catch (error) {
  console.error(error);
  const status = document.getElementById('boot-status');
  if (status)
    status.textContent = `Ledgerline could not start: ${(error as Error).message}. Reload to try again.`;
}
