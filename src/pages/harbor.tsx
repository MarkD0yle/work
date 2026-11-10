export const title = "Harbor";
export const section = "trading";
export const fullWidth = true;

/* Harbor — the interoperable desktop shell for trading apps, built separately
 * in /harbor as its own pnpm workspace. The deploy builds it into
 * dist/harbor/<app>/, and this page frames the shell. In local dev it points at
 * the shell's own dev server (run `pnpm dev` inside /harbor). */

const SHELL_URL = import.meta.env.DEV
  ? "http://localhost:5180/"
  : "/harbor/shell/";

export default function HarborPage() {
  return (
    <div className="flex h-screen flex-col bg-neutral-950">
      <div className="flex items-center justify-between gap-4 border-b border-neutral-800 py-2 pl-28 pr-4 text-xs text-neutral-300">
        <span>
          <span className="font-semibold text-white">Harbor</span>
          <span className="ml-2 text-neutral-400">
            Desktop shell with ten interoperable apps. All data is mock. Pick a
            user to sign in.
          </span>
        </span>
        <a
          href={SHELL_URL}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 border border-neutral-700 px-3 py-1 font-medium text-white hover:bg-neutral-800"
        >
          Open in a new tab
        </a>
      </div>
      <iframe
        title="Harbor"
        src={SHELL_URL}
        className="w-full flex-1 border-0"
      />
    </div>
  );
}
