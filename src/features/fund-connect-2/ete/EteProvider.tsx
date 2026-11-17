import { useMemo, useRef, useState, type ReactNode } from "react";
import { EteContext, type ActionResult, type EteApi, type View } from "./ete-context";
import { blankOrderType, cloneConfig, countBySeverity, diffConfigs, validate } from "./engine";
import type { User } from "../lib/types";
import { DEFAULT_FUND_ID, seedFunds } from "./mock-data";
import { INSTITUTIONS, type AuditEvent, type DetailSectionId, type Fund, type FundConfig, type TabId, type Target } from "./model";

/* EteProvider — owns the mock state and the workflow rules.
 *
 *   Draft → Validation → Submit → Awaiting approval → Approved → Active
 *                                        └→ Rejected → (revise) → Draft
 *
 * The acting user comes from the Fund Connect 2 header and keeps the roles
 * the register uses: submitters edit and submit, approvers decide.
 *
 * Two rules matter most:
 *  - The person who submits a change cannot approve or reject it, even when
 *    their role would otherwise allow it.
 *  - A pending change never touches the active version. Approval replaces
 *    the active version in one step; until then it stays in use, unchanged.
 *
 * State is in memory only. Reloading the page restores the seed. */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function stamp(): string {
  const d = new Date();
  const two = (n: number) => String(n).padStart(2, "0");
  return `${two(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${two(d.getHours())}:${two(d.getMinutes())}`;
}

const institutionName = (id: string) => INSTITUTIONS.find((i) => i.id === id)?.name ?? id;

const fail = (reason: string): ActionResult => ({ ok: false, reason });
const OK: ActionResult = { ok: true };

type Nav = { fundId: string; view: View; tab: TabId; orderTypeId: string | null; sections: DetailSectionId[] };

const START_NAV: Nav = { fundId: DEFAULT_FUND_ID, view: "pending", tab: "order-types", orderTypeId: null, sections: ["identifiers"] };

export function EteProvider({ user, children }: { user: User; children: ReactNode }) {
  const [funds, setFunds] = useState<Fund[]>(seedFunds);
  const userId = user.id;
  const canSubmit = user.roles.includes("submitter");
  const canApprove = user.roles.includes("approver");
  const [nav, setNav] = useState<Nav>(START_NAV);
  const seq = useRef(0);

  const fund = funds.find((f) => f.id === nav.fundId) ?? funds[0];

  // A fund with only one version has nothing to switch between.
  const view: View = !fund.pending ? "active" : !fund.active ? "pending" : nav.view;
  const config = (view === "pending" ? fund.pending?.config : fund.active) as FundConfig;
  const isDraft = view === "pending" && fund.pending?.state === "draft";
  const editable = isDraft && canSubmit;
  const readOnlyReason = editable
    ? ""
    : isDraft
      ? "Your role reviews and approves changes. Switch Acting as to a submitter to edit this draft."
      : view === "active"
        ? fund.pending
          ? "This is the active version. It cannot be edited directly; changes are made in the pending version."
          : "This is the active version. Choose Modify configuration to start a draft."
        : fund.pending?.state === "awaiting"
          ? "This change is awaiting approval and is locked until it is approved, rejected or withdrawn."
          : "This change was rejected. Choose Revise to reopen it as a draft.";

  const issues = useMemo(() => validate(config), [config]);
  const pendingConfig = fund.pending?.config;
  const pendingIssues = useMemo(() => (pendingConfig ? validate(pendingConfig) : []), [pendingConfig]);
  const diff = useMemo(
    () => (fund.active && pendingConfig ? diffConfigs(fund.active, pendingConfig, institutionName) : null),
    [fund.active, pendingConfig],
  );

  const api = useMemo<EteApi>(() => {
    const nextId = (prefix: string) => {
      seq.current += 1;
      return `${prefix}-${seq.current}`;
    };

    /** Replace the selected fund, stamping who touched it and when. */
    const write = (change: (f: Fund) => Fund, log?: Omit<AuditEvent, "id" | "at" | "actor">) => {
      const at = stamp();
      const entry: AuditEvent | null = log ? { ...log, id: nextId("event"), at, actor: userId } : null;
      setFunds((list) =>
        list.map((f) => {
          if (f.id !== fund.id) return f;
          const next = change(f);
          return { ...next, lastModifiedBy: userId, lastModifiedAt: at, history: entry ? [entry, ...next.history] : next.history };
        }),
      );
    };

    const pending = fund.pending;

    return {
      funds,
      fund,
      user,
      selectFund: (id) => setNav({ ...START_NAV, fundId: id }),

      view,
      setView: (v) => setNav((n) => ({ ...n, view: v })),
      config,
      editable,
      readOnlyReason,
      issues,
      pendingIssues,
      diff,

      tab: nav.tab,
      setTab: (tab) => setNav((n) => ({ ...n, tab })),
      openOrderTypeId: nav.orderTypeId,
      openOrderType: (id) => setNav((n) => ({ ...n, orderTypeId: id, tab: id ? "order-types" : n.tab })),
      openSections: nav.sections,
      toggleSection: (id) =>
        setNav((n) => ({ ...n, sections: n.sections.includes(id) ? n.sections.filter((s) => s !== id) : [...n.sections, id] })),
      goTo: (target: Target) =>
        setNav((n) => ({
          ...n,
          // Messages and changes are about the pending version.
          view: fund.pending ? "pending" : n.view,
          tab: target.tab,
          orderTypeId: target.orderTypeId ?? (target.tab === "order-types" ? null : n.orderTypeId),
          sections: target.section && !n.sections.includes(target.section) ? [...n.sections, target.section] : n.sections,
        })),

      update: (recipe) => {
        if (!editable || !pending) return;
        const draft = cloneConfig(pending.config);
        recipe(draft);
        write((f) => ({ ...f, pending: f.pending && { ...f.pending, config: draft } }));
      },

      addOrderType: () => {
        if (!editable || !pending) return;
        const id = nextId("ot-new");
        const draft = cloneConfig(pending.config);
        const taken = new Set(draft.orderTypes.map((o) => o.name.trim().toLowerCase()));
        let n = 1;
        let name = "New Order Type";
        while (taken.has(name.toLowerCase())) {
          n += 1;
          name = `New Order Type ${n}`;
        }
        draft.orderTypes.push(blankOrderType(id, name));
        write((f) => ({ ...f, pending: f.pending && { ...f.pending, config: draft } }));
        setNav((nv) => ({ ...nv, tab: "order-types", orderTypeId: id }));
      },

      removeOrderType: (id) => {
        if (!editable || !pending) return;
        const draft = cloneConfig(pending.config);
        draft.orderTypes = draft.orderTypes.filter((o) => o.id !== id);
        if (draft.defaultCreationId === id) draft.defaultCreationId = null;
        if (draft.defaultRedemptionId === id) draft.defaultRedemptionId = null;
        write((f) => ({ ...f, pending: f.pending && { ...f.pending, config: draft } }));
        setNav((nv) => ({ ...nv, orderTypeId: nv.orderTypeId === id ? null : nv.orderTypeId }));
      },

      startModification: () => {
        if (!fund.active) return fail("This fund has no active version to modify.");
        if (pending) return fail("A change is already in progress for this fund.");
        if (!canSubmit) return fail("Your role cannot start a change. Switch Acting as to a submitter.");
        const copy = cloneConfig(fund.active);
        write((f) => ({ ...f, pending: { config: copy, state: "draft", createdBy: userId } }), {
          title: "Started a modification",
          detail: `Draft created from active version ${fund.activeVersion}.`,
        });
        setNav((n) => ({ ...n, view: "pending" }));
        return OK;
      },

      discardDraft: () => {
        if (!pending || pending.state === "awaiting") return fail("There is no draft to discard.");
        if (!canSubmit) return fail("Your role cannot discard a draft.");
        if (!fund.active) return fail("A new fund's draft cannot be discarded in this prototype.");
        write((f) => ({ ...f, pending: null }), { title: "Discarded the draft", detail: `Active version ${fund.activeVersion} was not changed.` });
        setNav((n) => ({ ...n, view: "active", orderTypeId: null }));
        return OK;
      },

      submit: () => {
        if (!pending || pending.state !== "draft") return fail("Only a draft can be submitted.");
        if (!canSubmit) return fail("Your role cannot submit changes. Switch Acting as to a submitter.");
        const { errors } = countBySeverity(validate(pending.config));
        if (errors > 0) return fail(`Fix ${errors} validation ${errors === 1 ? "error" : "errors"} before submitting.`);
        const at = stamp();
        write((f) => ({ ...f, pending: f.pending && { ...f.pending, state: "awaiting", submittedBy: userId, submittedAt: at, rejectedBy: undefined, rejectedAt: undefined, rejectionReason: undefined } }), {
          title: "Submitted for approval",
          detail: "Validation passed with no errors.",
          tone: "info",
        });
        return OK;
      },

      withdraw: () => {
        if (!pending || pending.state !== "awaiting") return fail("Nothing is awaiting approval.");
        if (pending.submittedBy !== userId) return fail("Only the person who submitted the change can withdraw it.");
        write((f) => ({ ...f, pending: f.pending && { ...f.pending, state: "draft" } }), { title: "Withdrew the submission", detail: "Back to draft for further edits." });
        return OK;
      },

      approve: () => {
        if (!pending || pending.state !== "awaiting") return fail("Nothing is awaiting approval.");
        if (pending.submittedBy === userId) return fail("You submitted this change, so you cannot approve it.");
        if (!canApprove) return fail("Your role cannot approve changes.");
        const version = fund.activeVersion + 1;
        write((f) => ({ ...f, active: f.pending ? f.pending.config : f.active, activeVersion: version, pending: null }), {
          title: "Approved and activated",
          detail: `Version ${version} is in use.`,
          tone: "positive",
        });
        setNav((n) => ({ ...n, view: "active" }));
        return OK;
      },

      reject: (reason) => {
        if (!pending || pending.state !== "awaiting") return fail("Nothing is awaiting approval.");
        if (pending.submittedBy === userId) return fail("You submitted this change, so you cannot reject it.");
        if (!canApprove) return fail("Your role cannot reject changes.");
        if (!reason.trim()) return fail("Give a reason so the submitter knows what to fix.");
        const at = stamp();
        write((f) => ({ ...f, pending: f.pending && { ...f.pending, state: "rejected", rejectedBy: userId, rejectedAt: at, rejectionReason: reason.trim() } }), {
          title: "Rejected",
          detail: reason.trim(),
          tone: "negative",
        });
        return OK;
      },

      revise: () => {
        if (!pending || pending.state !== "rejected") return fail("Only a rejected change can be revised.");
        if (!canSubmit) return fail("Your role cannot revise changes.");
        write((f) => ({ ...f, pending: f.pending && { ...f.pending, state: "draft" } }), { title: "Reopened as a draft", detail: "Revising after rejection." });
        return OK;
      },

      reset: () => {
        setFunds(seedFunds());
        setNav(START_NAV);
      },
    };
  }, [funds, fund, user, userId, canSubmit, canApprove, view, config, editable, readOnlyReason, issues, pendingIssues, diff, nav]);

  return <EteContext.Provider value={api}>{children}</EteContext.Provider>;
}
