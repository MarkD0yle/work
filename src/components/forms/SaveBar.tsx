/* SaveBar — the "you have unsaved changes" action bar that docks to the
 * bottom of a settings surface once the form is dirty. Stays out of the way
 * when there's nothing to save. */
export function SaveBar({
  dirty,
  saving,
  saved,
  onSave,
  onReset,
  message = "You have unsaved changes",
}: {
  dirty: boolean;
  saving?: boolean;
  saved?: boolean;
  onSave: () => void;
  onReset: () => void;
  message?: string;
}) {
  if (!dirty && !saved) return null;

  return (
    <div className="sticky bottom-0 z-10 mt-6 flex items-center justify-between gap-4 rounded-xl border border-neutral-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
      <div className="flex items-center gap-2 text-sm">
        {saved && !dirty ? (
          <>
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path
                  fillRule="evenodd"
                  d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
            <span className="text-neutral-600">All changes saved</span>
          </>
        ) : (
          <>
            <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
            <span className="text-neutral-700">{message}</span>
          </>
        )}
      </div>
      {dirty && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onReset}
            disabled={saving}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="rounded-md bg-neutral-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      )}
    </div>
  );
}
