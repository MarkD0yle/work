export const title = "Ledgerline";
export const section = "operations";
export const fullWidth = true;

/* Ledgerline — the investment accounting operations workbench, built separately
 * in /ledgerline as its own pnpm workspace. The deploy builds its hosted demo
 * (apps/demo) into dist/ledgerline/, where the mock API runs inside the page on
 * a seeded in-browser database. In local dev this points at the real dev server
 * (run `pnpm dev` inside /ledgerline). */

const APP_URL = import.meta.env.DEV
  ? "http://localhost:5310/"
  : "/ledgerline/";

export default function LedgerlinePage() {
  return (
    <div className="flex h-screen flex-col bg-neutral-950">
      <div className="flex items-center justify-between gap-4 border-b border-neutral-800 py-2 pl-28 pr-4 text-xs text-neutral-300">
        <span>
          <span className="font-semibold text-white">Ledgerline</span>
          <span className="ml-2 text-neutral-400">
            Investment accounting workbench. All data is mock and lives in
            your browser: reloading starts it fresh. Switch user from the top
            right.
          </span>
        </span>
        <a
          href={APP_URL}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 border border-neutral-700 px-3 py-1 font-medium text-white hover:bg-neutral-800"
        >
          Open in a new tab
        </a>
      </div>
      <iframe
        title="Ledgerline"
        src={APP_URL}
        className="w-full flex-1 border-0"
      />
    </div>
  );
}
