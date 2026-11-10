import { usePageComponent } from "../../hooks/usePageCatalogue";

/* ScreenStage — renders another screen inside a tool (Demo Reel, Side by
 * Side). It repeats the two wrappers App.tsx gives a page, so a screen looks
 * the same here as it does when opened directly. Only mount the screens that
 * are on show: many of them carry heavy grids and charts. */
export function ScreenStage({ slug }: { slug: string }) {
  const page = usePageComponent(slug);
  if (!page) {
    return (
      <div className="grid h-full place-items-center text-sm text-neutral-500">
        Loading screen…
      </div>
    );
  }
  const { Component, fullWidth } = page;
  return fullWidth ? (
    <div className="h-screen overflow-hidden">
      <Component />
    </div>
  ) : (
    <div className="h-screen overflow-y-auto">
      <div className="mx-auto max-w-5xl px-8 py-10">
        <Component />
      </div>
    </div>
  );
}
