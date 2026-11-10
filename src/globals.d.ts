/* Build-time constants injected via `define` in vite.config.ts. */
declare const __PAGES_ADDED_AT__: Record<string, number>;

/* Build-time source scan of every screen (scripts/pageIntel.ts), exposed by
 * the page-intel plugin in vite.config.ts. Read it through src/lib/pageIntel. */
declare module "virtual:page-intel" {
  export const intel: {
    generatedAt: number;
    patterns: string[];
    pages: Record<
      string,
      {
        files: number;
        lines: number;
        drift: { radius: number; hex: number; inlineStyle: number };
      }
    >;
  };
}
