function App() {
  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900 antialiased">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-start justify-center gap-6 px-8">
        <span className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium tracking-wide uppercase text-neutral-500">
          Design workspace
        </span>
        <h1 className="text-5xl font-semibold tracking-tight text-neutral-950 sm:text-6xl">
          Work
        </h1>
        <p className="max-w-prose text-lg text-neutral-600">
          A personal sandbox for exploring design ideas. Edit{" "}
          <code className="rounded bg-neutral-200 px-1.5 py-0.5 font-mono text-sm text-neutral-800">
            src/App.tsx
          </code>{" "}
          to begin.
        </p>
        <div className="mt-4 flex gap-3">
          <a
            href="https://tailwindcss.com/docs"
            target="_blank"
            rel="noreferrer"
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700"
          >
            Tailwind docs
          </a>
          <a
            href="https://react.dev"
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-900 transition hover:bg-neutral-100"
          >
            React docs
          </a>
        </div>
      </div>
    </main>
  );
}

export default App;
