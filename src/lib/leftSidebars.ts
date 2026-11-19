/* Left-sidebar pattern catalogue.
 *
 * Ten primary-navigation sidebars for one investment services platform (fund
 * accounting, reconciliation, transfer agency, custody, oversight). All ten
 * carry the same menu, so each one is an answer to a different question about
 * the same column of chrome:
 *
 *   - What is the list ordered by?   structure · process · urgency · habit
 *   - How much width does it take?   56px · 240–290px
 *   - What does it show besides links?   nothing · counts · state · scope
 *   - Who is it tuned for?   everyone · one role · the daily expert
 */

export type SidebarId =
  | "grouped"
  | "icon-rail"
  | "dual-rail"
  | "tree"
  | "scope"
  | "cycle"
  | "queue"
  | "command"
  | "terminal"
  | "role";

export type SidebarExample = {
  id: SidebarId;
  /** Ordinal shown in the picker. */
  n: number;
  name: string;
  /** What the navigation is organised around. */
  pattern: string;
  /** Width in pixels when fully open. */
  width: number;
  /** One line on what it is. */
  summary: string;
  /** The design argument: why this shape, and what it trades away. */
  rationale: string;
  bestFor: string;
  watchOut: string;
};

export const SIDEBAR_EXAMPLES: SidebarExample[] = [
  {
    id: "grouped",
    n: 1,
    name: "Grouped list",
    pattern: "By structure",
    width: 256,
    summary: "Every page visible under plain module headings, with open-item counts.",
    rationale:
      "The baseline. Nothing is hidden, so there is nothing to learn: a new joiner can read the whole platform top to bottom. The cost is space. With 27 pages the list scrolls on a laptop, and it takes 256 pixels from every grid.",
    bestFor: "Mixed audiences and occasional users.",
    watchOut: "Stops scaling somewhere past 30 links.",
  },
  {
    id: "icon-rail",
    n: 2,
    name: "Icon rail with flyouts",
    pattern: "By structure, compact",
    width: 56,
    summary: "One icon per module. Hover or focus opens that module's pages beside it.",
    rationale:
      "Gives the width back to the work. A NAV grid with forty columns wants every pixel, and 56 is as low as navigation goes while still being a target. Each icon keeps a short text label because seven abstract icons are not recognisable on their own.",
    bestFor: "Wide grids and reconciliation screens.",
    watchOut: "Every page is two steps away, and hover menus are fiddly on touch.",
  },
  {
    id: "dual-rail",
    n: 3,
    name: "Rail and context column",
    pattern: "Two levels, two columns",
    width: 265,
    summary: "A fixed module rail plus a column for the pages of the module being browsed.",
    rationale:
      "Separates choosing a module from choosing a page. The rail never moves, so the modules build muscle memory; the column can go three levels deep without indenting the whole menu. Browsing another module does not leave the current page, and the column folds away when the grid needs room.",
    bestFor: "Large platforms with deep modules.",
    watchOut: "Only one module's pages are visible at a time.",
  },
  {
    id: "tree",
    n: 4,
    name: "Accordion tree",
    pattern: "Three levels, one column",
    width: 288,
    summary: "Collapsible modules and sub-pages. Closed branches roll their counts up.",
    rationale:
      "The only variation that shows three levels at once, which suits reconciliation where Cash splits into nostro, custody and margin. The user chooses what stays open and the tree never closes a branch for them. A folded module still shows its total, so collapsing is tidy rather than risky.",
    bestFor: "Deep hierarchies that people leave partly open.",
    watchOut: "Fully expanded it is the longest list here.",
  },
  {
    id: "scope",
    n: 5,
    name: "Fund scope switcher",
    pattern: "By entity, then structure",
    width: 256,
    summary: "A fund selector above the menu. Every count below it is for the fund in scope.",
    rationale:
      "In fund administration the first question is which fund, not which page. Putting scope at the top of the sidebar makes it global and visible, and turns the menu into that fund's status board. Changing fund keeps the page, so stepping through funds on Cash Reconciliation is one click each.",
    bestFor: "Fund accountants working one fund at a time.",
    watchOut: "Cross-fund work needs an explicit All funds scope.",
  },
  {
    id: "cycle",
    n: 6,
    name: "NAV cycle",
    pattern: "By process",
    width: 288,
    summary: "Pages listed as the steps of the daily NAV, in order, each with its state.",
    rationale:
      "The NAV is a dependency chain: no pricing until positions agree, no sign-off until the NAV is struck. Ordering the menu the same way means the sidebar answers where today's NAV is and what is blocking it. Pages outside the cycle sit below in a plain list.",
    bestFor: "Deadline-driven production teams.",
    watchOut: "Only works where the process really is linear.",
  },
  {
    id: "queue",
    n: 7,
    name: "Work queue",
    pattern: "By urgency",
    width: 288,
    summary: "Pages sorted by what needs attention, with counts, deadlines and a Mine or Team view.",
    rationale:
      "Treats navigation as triage. The page with breaches is first, quiet pages fold into one line. The order shifts through the day, which costs positional memory, so every row keeps a stable label and a reason for where it sits.",
    bestFor: "Exception-led operations and team leads.",
    watchOut: "A moving list is harder to learn than a fixed one.",
  },
  {
    id: "command",
    n: 8,
    name: "Search first",
    pattern: "By habit",
    width: 256,
    summary: "A filter box, then pinned and recent pages, with the full menu underneath.",
    rationale:
      "Most people use five pages. This puts those five at the top by letting each user pin them, and gets everyone else there by typing a name or a short code. The full module list stays one click away for the rare trip elsewhere.",
    bestFor: "Experienced users with a personal set of pages.",
    watchOut: "New users have nothing pinned and must browse.",
  },
  {
    id: "terminal",
    n: 9,
    name: "Dense terminal",
    pattern: "By code",
    width: 240,
    summary: "A dark, monospaced list at 24 pixels a row with a code for every page.",
    rationale:
      "For operators who spend the whole day here. Each page has a mnemonic, the command line takes a code and Enter, and codes and counts sit in fixed columns so the eye can scan them. It asks for learning up front and repays it in speed.",
    bestFor: "Full-time expert users on large monitors.",
    watchOut: "Small type and codes are a barrier for casual users.",
  },
  {
    id: "role",
    n: 10,
    name: "Role workspace",
    pattern: "By role",
    width: 256,
    summary: "The role at the top chooses which pages lead. Locked pages say why.",
    rationale:
      "A fund accountant, a reconciliation analyst and an oversight manager share a platform but not a day. Each role gets its own short list in working order, with the rest one click away. Pages the role may not open are shown locked with a reason, which is more useful than leaving them out.",
    bestFor: "Platforms serving several distinct teams.",
    watchOut: "Someone has to own and maintain each role's list.",
  },
];
