import { useEte } from "./ete-context";
import { activePeriods, countBySeverity, directionLabel, issuesAt, issuesForOrderType, path } from "./engine";
import { BASKET_TYPES, cnsApplies, periodLabel, type BasketType, type OrderType, type SettlementPeriod } from "./model";
import { btn, cx, eyebrow, focusRing, muted } from "./styles";
import { Badge, Check, EmptyNote, IssueCounts, Messages, SelectField, Switch, TextField, TimeWindow } from "./ui";

/* Order Types — the primary area of the workspace.
 *
 * The list stays on screen while one Order Type is edited in a panel docked
 * beside it: no modal, and nothing to save or lose, because every edit goes
 * straight into the fund's draft. Settlement Periods are edited inside the
 * Order Type they belong to and nowhere else. */

function capabilities(o: OrderType): string[] {
  return [o.assistedTrading && "Assisted Trading", o.cashInLieu && "Cash-in-Lieu", o.directedTrading && "Directed Trading"].filter(Boolean) as string[];
}

export function OrderTypesTab() {
  const { config, editable, issues, update, addOrderType, openOrderTypeId, openOrderType } = useEte();
  const open = config.orderTypes.find((o) => o.id === openOrderTypeId) ?? null;

  const creationOptions = config.orderTypes.filter((o) => o.enabled && o.creation).map((o) => ({ value: o.id, label: o.name || "Unnamed Order Type" }));
  const redemptionOptions = config.orderTypes.filter((o) => o.enabled && o.redemption).map((o) => ({ value: o.id, label: o.name || "Unnamed Order Type" }));
  // Keep a default that is no longer valid selectable, so its error has a home.
  const withCurrent = (options: { value: string; label: string }[], id: string | null) => {
    if (!id || options.some((o) => o.value === id)) return options;
    const o = config.orderTypes.find((x) => x.id === id);
    return [...options, { value: id, label: `${o?.name ?? "Removed Order Type"} (not available)` }];
  };

  return (
    <div className={cx("grid h-full min-h-0 grid-cols-1", open && "lg:grid-cols-[minmax(0,1fr)_30rem]")}>
      <div className={cx("min-h-0 min-w-0 overflow-y-auto p-6", open && "max-lg:hidden")}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">Order Types</h2>
            <p className={muted}>What Authorised Participants can place on this fund. Each Order Type carries its own Settlement Periods.</p>
          </div>
          <button type="button" onClick={addOrderType} disabled={!editable} className={btn.primary}>
            Add Order Type
          </button>
        </div>
        <Messages issues={issuesAt(issues, path.orderTypes)} />

        <div className="mt-4 grid grid-cols-1 gap-4 border border-neutral-200 bg-white p-4 sm:grid-cols-2">
          <SelectField
            label="Default Creation Order Type (optional)"
            value={config.defaultCreationId ?? ""}
            onChange={(v) => update((d) => void (d.defaultCreationId = v || null))}
            options={withCurrent(creationOptions, config.defaultCreationId)}
            emptyLabel="No default"
            disabled={!editable}
            issues={issuesAt(issues, path.defaultCreation)}
            hint="Preselected when a user starts a Creation order."
          />
          <SelectField
            label="Default Redemption Order Type (optional)"
            value={config.defaultRedemptionId ?? ""}
            onChange={(v) => update((d) => void (d.defaultRedemptionId = v || null))}
            options={withCurrent(redemptionOptions, config.defaultRedemptionId)}
            emptyLabel="No default"
            disabled={!editable}
            issues={issuesAt(issues, path.defaultRedemption)}
            hint="Preselected when a user starts a Redemption order."
          />
        </div>

        <div className="mt-4 border border-neutral-200 bg-white">
          {config.orderTypes.length === 0 ? (
            <EmptyNote title="No Order Types yet" action={editable ? { label: "Add the first Order Type", onClick: addOrderType } : undefined}>
              A fund needs at least one enabled Order Type before it can take orders.
            </EmptyNote>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] text-left text-xs">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50">
                    {["Order Type", "In use", "Order direction", "Capabilities", "Settlement Periods", "Checks"].map((h) => (
                      <th key={h} scope="col" className={cx("px-3 py-2", eyebrow)}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {config.orderTypes.map((o) => {
                    const counts = countBySeverity(issuesForOrderType(issues, o.id));
                    const act = activePeriods(o);
                    const caps = capabilities(o);
                    const selected = o.id === openOrderTypeId;
                    const defaults = [config.defaultCreationId === o.id && "Default for Creation", config.defaultRedemptionId === o.id && "Default for Redemption"].filter(Boolean) as string[];
                    return (
                      <tr key={o.id} className={cx("border-b border-neutral-100 align-top last:border-b-0", selected && "bg-neutral-100")}>
                        <th scope="row" className="px-3 py-2.5 font-normal">
                          <button
                            type="button"
                            onClick={() => openOrderType(selected ? null : o.id)}
                            aria-expanded={selected}
                            className={cx("text-left text-sm font-semibold underline-offset-2 hover:underline", o.enabled ? "text-neutral-900" : "text-neutral-500", focusRing)}
                          >
                            {o.name || "Unnamed Order Type"}
                          </button>
                          <div className="mt-0.5 text-[11px] text-neutral-500">
                            {[o.code && `Code ${o.code}`, `${o.basket} basket`].filter(Boolean).join(" · ")}
                          </div>
                          {defaults.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {defaults.map((t) => (
                                <Badge key={t}>{t}</Badge>
                              ))}
                            </div>
                          )}
                        </th>
                        <td className="px-3 py-2.5">
                          <Switch
                            checked={o.enabled}
                            disabled={!editable}
                            label={`${o.name || "Order Type"} in use`}
                            onText="Enabled"
                            offText="Disabled"
                            onChange={(v) => update((d) => void (d.orderTypes.find((x) => x.id === o.id)!.enabled = v))}
                          />
                          {!o.enabled && <div className="mt-0.5 text-[11px] text-neutral-500">Configuration kept</div>}
                        </td>
                        <td className="px-3 py-2.5 text-neutral-700">{directionLabel(o)}</td>
                        <td className="px-3 py-2.5 text-neutral-700">{caps.length ? caps.join(", ") : <span className="text-neutral-400">None</span>}</td>
                        <td className="px-3 py-2.5">
                          {act.length ? (
                            <div className="flex flex-wrap gap-1">
                              {act.map((p) => (
                                <span key={p.day} className="border border-neutral-300 px-1.5 py-[1px] font-mono text-[11px] text-neutral-700">
                                  {periodLabel(p.day)}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-neutral-400">None active</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-wrap gap-1">
                            {counts.errors + counts.warnings > 0 ? <IssueCounts {...counts} /> : <span className="text-neutral-500">No issues</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <p className={cx("mt-2", muted)}>Select an Order Type to configure it. The list stays here while you edit.</p>
      </div>

      {open && <OrderTypePanel key={open.id} orderType={open} />}
    </div>
  );
}

function OrderTypePanel({ orderType: o }: { orderType: OrderType }) {
  const { fund, config, editable, issues, update, openOrderType, removeOrderType } = useEte();
  const cns = cnsApplies(config);
  const inActive = fund.active?.orderTypes.some((x) => x.id === o.id) ?? false;
  const counts = countBySeverity(issuesForOrderType(issues, o.id));

  const set = (recipe: (ot: OrderType) => void) =>
    update((d) => {
      const ot = d.orderTypes.find((x) => x.id === o.id);
      if (ot) recipe(ot);
    });
  const setPeriod = (day: number, recipe: (p: SettlementPeriod, ot: OrderType) => void) => set((ot) => recipe(ot.periods[day], ot));

  return (
    <aside aria-label={`Order Type ${o.name}`} className="flex min-h-0 min-w-0 flex-col border-l border-neutral-200 bg-white">
      <header className="flex items-start gap-3 border-b border-neutral-200 px-5 py-3">
        <div className="min-w-0 flex-1">
          <div className={eyebrow}>Order Type</div>
          <h2 className="truncate text-base font-semibold text-neutral-900">{o.name || "Unnamed Order Type"}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge tone={o.enabled ? "good" : "neutral"}>{o.enabled ? "Enabled" : "Disabled"}</Badge>
            <IssueCounts {...counts} />
            {!inActive && fund.active && <Badge tone="info">New in this change</Badge>}
          </div>
        </div>
        <button type="button" onClick={() => openOrderType(null)} className={btn.secondary}>
          Close
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <section className="border-b border-neutral-200 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-neutral-900">In use</div>
              <p className="text-[11px] text-neutral-500">Disabling keeps every setting below, ready to switch back on.</p>
            </div>
            <Switch checked={o.enabled} disabled={!editable} label={`${o.name || "Order Type"} in use`} onText="Enabled" offText="Disabled" onChange={(v) => set((ot) => void (ot.enabled = v))} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <TextField label="Name" value={o.name} disabled={!editable} onChange={(v) => set((ot) => void (ot.name = v))} issues={issuesAt(issues, path.otName(o.id))} />
            </div>
            <TextField label="Short code (optional)" value={o.code} disabled={!editable} mono onChange={(v) => set((ot) => void (ot.code = v.toUpperCase()))} />
            <SelectField label="Basket" value={o.basket} disabled={!editable} options={[...BASKET_TYPES]} emptyLabel={null} onChange={(v) => set((ot) => void (ot.basket = v as BasketType))} />
          </div>
        </section>

        <section className="border-b border-neutral-200 px-5 py-4">
          <h3 className={eyebrow}>Order direction</h3>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
            <Check
              label="Creation"
              checked={o.creation}
              disabled={!editable}
              onChange={(v) =>
                set((ot) => {
                  ot.creation = v;
                  // A period cannot allow what its Order Type does not offer.
                  if (!v) for (const p of ot.periods) p.creationAllowed = false;
                })
              }
            />
            <Check
              label="Redemption"
              checked={o.redemption}
              disabled={!editable}
              onChange={(v) =>
                set((ot) => {
                  ot.redemption = v;
                  if (!v) for (const p of ot.periods) p.redemptionAllowed = false;
                })
              }
            />
          </div>
          <Messages issues={issuesAt(issues, path.otDirections(o.id))} />
        </section>

        <section className="border-b border-neutral-200 px-5 py-4">
          <h3 className={eyebrow}>Capabilities</h3>
          <div className="mt-2 flex flex-col gap-2">
            <Check label="Assisted Trading" hint="The desk can place and amend orders on the participant's behalf." checked={o.assistedTrading} disabled={!editable} onChange={(v) => set((ot) => void (ot.assistedTrading = v))} />
            <Check label="Cash-in-Lieu" hint="Named basket positions can be replaced by cash." checked={o.cashInLieu} disabled={!editable} onChange={(v) => set((ot) => void (ot.cashInLieu = v))} />
            <Check label="Directed Trading" hint="The participant can name the broker that executes the basket." checked={o.directedTrading} disabled={!editable} onChange={(v) => set((ot) => void (ot.directedTrading = v))} />
          </div>
        </section>

        <section className="px-5 py-4">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className={eyebrow}>Settlement Periods</h3>
            <span className="text-[11px] text-neutral-500">Times in {config.details.cutoffTimezone || "the fund's time zone"}</span>
          </div>
          <Messages issues={issuesAt(issues, path.otPeriods(o.id))} />
          {!cns && <p className="mt-1 text-[11px] text-neutral-500">CNS is not offered on {config.details.settlementVenue || "this settlement venue"}, so it is switched off for these periods.</p>}
          <ul className="mt-2 flex flex-col gap-2">
            {o.periods.map((p) => (
              <li key={p.day} className={cx("border", p.active ? "border-neutral-300" : "border-neutral-200 bg-neutral-50")}>
                <div className="flex items-center gap-3 px-3 py-2">
                  <span className="w-9 font-mono text-sm font-semibold text-neutral-900">{periodLabel(p.day)}</span>
                  <span className="min-w-0 flex-1 truncate text-[11px] text-neutral-500">
                    {p.active ? (p.day === 0 ? "Settles on trade date" : `Settles ${p.day} business ${p.day === 1 ? "day" : "days"} after trade date`) : "Not offered"}
                  </span>
                  <Switch
                    checked={p.active}
                    disabled={!editable}
                    label={`${periodLabel(p.day)} active`}
                    onText="Active"
                    offText="Inactive"
                    onChange={(v) =>
                      setPeriod(p.day, (sp, ot) => {
                        sp.active = v;
                        // First time on: start from what the Order Type offers.
                        if (v && !sp.tOpen && !sp.tClose) {
                          sp.creationAllowed = ot.creation;
                          sp.redemptionAllowed = ot.redemption;
                          sp.tOpen = "09:00";
                          sp.tClose = "16:00";
                        }
                      })
                    }
                  />
                </div>
                {p.active && (
                  <div className="border-t border-neutral-200 px-3 py-3">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      <Check
                        label="Creation allowed"
                        hint={o.creation ? undefined : "Order Type is not enabled for Creation"}
                        checked={p.creationAllowed}
                        disabled={!editable || !o.creation}
                        onChange={(v) => setPeriod(p.day, (sp) => void (sp.creationAllowed = v))}
                      />
                      <Check
                        label="Redemption allowed"
                        hint={o.redemption ? undefined : "Order Type is not enabled for Redemption"}
                        checked={p.redemptionAllowed}
                        disabled={!editable || !o.redemption}
                        onChange={(v) => setPeriod(p.day, (sp) => void (sp.redemptionAllowed = v))}
                      />
                      <Check label="Approval required" checked={p.approvalRequired} disabled={!editable} onChange={(v) => setPeriod(p.day, (sp) => void (sp.approvalRequired = v))} />
                      <Check
                        label="CNS"
                        hint={cns ? "Continuous Net Settlement" : "Not applicable on this venue"}
                        checked={p.cns}
                        disabled={!editable || (!cns && !p.cns)}
                        onChange={(v) => setPeriod(p.day, (sp) => void (sp.cns = v))}
                      />
                    </div>
                    <Messages
                      issues={[
                        ...issuesAt(issues, path.periodDirections(o.id, p.day)),
                        ...issuesAt(issues, path.periodApproval(o.id, p.day)),
                        ...issuesAt(issues, path.periodCns(o.id, p.day)),
                      ]}
                    />
                    <div className="mt-3 grid grid-cols-1 gap-3">
                      <TimeWindow
                        legend="Order window on trade date (T)"
                        open={p.tOpen}
                        close={p.tClose}
                        disabled={!editable}
                        issues={issuesAt(issues, path.periodT(o.id, p.day))}
                        onOpen={(v) => setPeriod(p.day, (sp) => void (sp.tOpen = v))}
                        onClose={(v) => setPeriod(p.day, (sp) => void (sp.tClose = v))}
                      />
                      <TimeWindow
                        legend="Order window on the day before (T-1)"
                        open={p.t1Open}
                        close={p.t1Close}
                        disabled={!editable}
                        issues={issuesAt(issues, path.periodT1(o.id, p.day))}
                        hint="Leave both empty if orders are not accepted the day before."
                        onOpen={(v) => setPeriod(p.day, (sp) => void (sp.t1Open = v))}
                        onClose={(v) => setPeriod(p.day, (sp) => void (sp.t1Close = v))}
                      />
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 px-5 py-3">
        <p className="min-w-0 flex-1 text-[11px] text-neutral-500">
          {editable ? "Changes are kept in the draft as you make them." : "Read-only."}
          {editable && inActive && " This Order Type is in the active version, so it can be disabled but not removed."}
        </p>
        {editable && !inActive && (
          <button type="button" onClick={() => removeOrderType(o.id)} className={btn.warn}>
            Remove Order Type
          </button>
        )}
      </footer>
    </aside>
  );
}
