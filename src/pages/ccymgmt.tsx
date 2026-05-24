export const title = "CCY Management";

export default function CcyMgmt() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium tracking-wide uppercase text-neutral-500">
          Page
        </span>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-neutral-950">
          CCY Management
        </h1>
        <p className="mt-2 max-w-prose text-neutral-600">
          Manage currencies, rates, and exposure here.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: "Active currencies", value: "12" },
          { label: "Pending updates", value: "3" },
          { label: "Last sync", value: "2 min ago" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-neutral-200 bg-white p-4"
          >
            <div className="text-xs font-medium tracking-wide uppercase text-neutral-500">
              {stat.label}
            </div>
            <div className="mt-2 text-2xl font-semibold text-neutral-950">
              {stat.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
