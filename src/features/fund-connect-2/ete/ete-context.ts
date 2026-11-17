import { createContext, useContext } from "react";
import type { Diff, Issue } from "./engine";
import type { User } from "../lib/types";
import type { DetailSectionId, Fund, FundConfig, TabId, Target } from "./model";

/* useEte — the shared mock state behind the ETE Fund Configuration page.
 *
 * Every edit is written straight into the fund's draft, which lives here and
 * not in the tab or panel that made it. That is why moving between Fund
 * Details, an Order Type and Review never loses work: there is no local form
 * buffer to throw away. */

/** Which version of the selected fund is on screen. */
export type View = "pending" | "active";

export type ActionResult = { ok: true } | { ok: false; reason: string };

export type EteApi = {
  funds: Fund[];
  fund: Fund;
  /** The Fund Connect 2 user chosen in the page header ("Acting as"). */
  user: User;
  selectFund: (id: string) => void;

  view: View;
  setView: (view: View) => void;
  /** The configuration on screen, for the chosen view. */
  config: FundConfig;
  /** True only for a draft, seen in the pending view, by a submitter. */
  editable: boolean;
  /** Why the screen is read-only, in words. Empty when editable. */
  readOnlyReason: string;
  /** Validation of the configuration on screen. */
  issues: Issue[];
  /** Validation of the pending change, whatever the view. Gates Submit. */
  pendingIssues: Issue[];
  /** Pending against active. Null when there is nothing to compare. */
  diff: Diff | null;

  tab: TabId;
  setTab: (tab: TabId) => void;
  openOrderTypeId: string | null;
  openOrderType: (id: string | null) => void;
  openSections: DetailSectionId[];
  toggleSection: (id: DetailSectionId) => void;
  /** Jump to where a validation message or a change lives. */
  goTo: (target: Target) => void;

  /** Edit the draft. The recipe mutates a private copy. No-op unless editable. */
  update: (recipe: (draft: FundConfig) => void) => void;
  addOrderType: () => void;
  removeOrderType: (id: string) => void;

  startModification: () => ActionResult;
  discardDraft: () => ActionResult;
  submit: () => ActionResult;
  withdraw: () => ActionResult;
  approve: () => ActionResult;
  reject: (reason: string) => ActionResult;
  revise: () => ActionResult;
  reset: () => void;
};

export const EteContext = createContext<EteApi | null>(null);

export function useEte(): EteApi {
  const api = useContext(EteContext);
  if (!api) throw new Error("useEte must be used inside <EteProvider>");
  return api;
}
