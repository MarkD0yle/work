import type { Message, ToleranceImpact, ToleranceRule } from '@ledgerline/contracts';
import {
  Button,
  formatIsoDate,
  fractionToPercent,
  Input,
  percentToFraction,
  SectionBanner,
  toast,
} from '@ledgerline/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  fetchPermissions,
  fetchTolerances,
  previewTolerances,
  problemOf,
  saveTolerances,
  type Me,
  type ToleranceEdit,
} from '../services';
import { ErrorPanel, LoadingPanel } from '../state-panels';

const CHECK: Record<ToleranceRule['check'], { label: string; unit: string }> = {
  dayOverDay: { label: 'Day-over-day move', unit: '%' },
  vendorVsVendor: { label: 'Vendor against vendor', unit: '%' },
  stale: { label: 'Stale after', unit: 'market days' },
  missing: { label: 'Missing price', unit: '' },
};
const ASSET: Record<string, string> = {
  govt: 'Government',
  corporate: 'Corporate',
  muni: 'Municipal',
  mbs: 'MBS',
  tba: 'TBA',
  equity: 'Equity',
  future: 'Future',
  swap: 'Swap',
  fxForward: 'FX forward',
};
const isPercent = (check: ToleranceRule['check']) => check === 'dayOverDay' || check === 'vendorVsVendor';
const shown = (rule: Pick<ToleranceRule, 'check' | 'threshold'>) =>
  isPercent(rule.check) ? fractionToPercent(rule.threshold) : rule.threshold;
const valid = (text: string) => /^\d+(\.\d+)?$/.test(text.trim());

interface Draft {
  /** What is typed: a percentage figure for moves, market days for stale. */
  text: string;
  holidayAware: boolean;
}

/**
 * Tolerance rules (SPEC 8.4). Market Data owns these thresholds. Before a change is saved, today's prices are
 * judged again under it and the screen says how many exceptions would appear or clear.
 */
export function ToleranceRules({ me }: { me: Me }) {
  const queryClient = useQueryClient();
  const rules = useQuery({ queryKey: ['tolerances'], queryFn: fetchTolerances });
  const permissions = useQuery({ queryKey: ['permissions', me.user.id], queryFn: fetchPermissions });
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [impact, setImpact] = useState<ToleranceImpact | null>(null);
  const [failure, setFailure] = useState<Message[] | null>(null);
  const [saving, setSaving] = useState(false);
  const edit = permissions.data?.find((p) => p.action === 'tolerance.edit');
  const readOnly =
    edit && !edit.allowed ? (edit.explanation ?? 'Your role cannot change tolerance rules.') : null;

  const changed = (rules.data ?? []).flatMap((rule): (ToleranceEdit & { invalid: boolean })[] => {
    const draft = drafts[rule.id];
    if (!draft) return [];
    const invalid = !valid(draft.text);
    const threshold = invalid
      ? rule.threshold
      : isPercent(rule.check)
        ? percentToFraction(draft.text.trim())
        : draft.text.trim();
    return threshold === rule.threshold && draft.holidayAware === rule.holidayAware && !invalid
      ? []
      : [{ id: rule.id, threshold, holidayAware: draft.holidayAware, invalid }];
  });
  const invalid = changed.some((c) => c.invalid);
  const edits = changed.filter((c) => !c.invalid).map(({ invalid: _invalid, ...e }) => e);
  const key = JSON.stringify(edits);

  // Every change is previewed against today's prices before it can be saved.
  useEffect(() => {
    const pending = JSON.parse(key) as ToleranceEdit[];
    if (pending.length === 0) return;
    let live = true;
    const timer = setTimeout(() => {
      previewTolerances(pending).then(
        (result) => live && setImpact(result),
        (error: unknown) => live && setFailure(problemOf(error)?.messages ?? []),
      );
    }, 350);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [key]);

  if (rules.isPending) return <LoadingPanel label="Loading tolerance rules…" />;
  if (rules.error)
    return (
      <ErrorPanel messages={problemOf(rules.error)?.messages ?? []} onRetry={() => void rules.refetch()} />
    );

  const set = (rule: ToleranceRule, patch: Partial<Draft>) => {
    setImpact(null);
    setFailure(null);
    setDrafts((prev) => ({
      ...prev,
      [rule.id]: { text: shown(rule), holidayAware: rule.holidayAware, ...prev[rule.id], ...patch },
    }));
  };
  const save = async () => {
    setSaving(true);
    try {
      queryClient.setQueryData(['tolerances'], await saveTolerances(edits));
      setDrafts({});
      setImpact(null);
      toast('Tolerance rules saved', `${edits.length} ${edits.length === 1 ? 'rule' : 'rules'} changed`);
    } catch (error) {
      setFailure(problemOf(error)?.messages ?? []);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex max-w-4xl flex-col gap-3" data-slot="tolerance-rules">
      {readOnly ? (
        <p data-slot="read-only-reason" className="rounded-md border bg-muted px-3 py-2">
          <span className="font-semibold">Read only.</span> {readOnly}
        </p>
      ) : null}
      {failure?.length ? <SectionBanner state={{ kind: 'blockingError', messages: failure }} /> : null}
      <div className="overflow-auto rounded-md border">
        <table aria-label="Tolerance rules" className="w-full text-body">
          <thead className="bg-muted text-left text-xs">
            <tr>
              <th scope="col" className="px-3 py-1.5 font-medium">
                Asset class
              </th>
              <th scope="col" className="px-3 py-1.5 font-medium">
                Check
              </th>
              <th scope="col" className="px-3 py-1.5 font-medium">
                Threshold
              </th>
              <th scope="col" className="px-3 py-1.5 font-medium">
                Skip market holidays
              </th>
              <th scope="col" className="px-3 py-1.5 font-medium">
                Version
              </th>
            </tr>
          </thead>
          <tbody>
            {rules.data.map((rule) => {
              const draft = drafts[rule.id];
              const name = `${ASSET[rule.assetClass] ?? rule.assetClass} ${CHECK[rule.check].label.toLowerCase()}`;
              const bad = draft ? !valid(draft.text) : false;
              return (
                <tr key={rule.id} data-rule-id={rule.id} className="border-t">
                  <th scope="row" className="px-3 py-1 text-left font-normal">
                    {ASSET[rule.assetClass] ?? rule.assetClass}
                  </th>
                  <td className="px-3 py-1">{CHECK[rule.check].label}</td>
                  <td className="px-3 py-1">
                    {rule.check === 'missing' ? (
                      <span className="text-muted-foreground">A price is required every market day</span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Input
                          aria-label={`${name} threshold`}
                          aria-invalid={bad || undefined}
                          className="tabular w-28 text-right font-mono"
                          value={draft?.text ?? shown(rule)}
                          disabled={Boolean(readOnly) || saving}
                          onChange={(e) => set(rule, { text: e.target.value })}
                        />
                        <span className="text-muted-foreground">{CHECK[rule.check].unit}</span>
                        {bad ? (
                          <span className="text-xs text-critical">Enter a number, such as 2.5.</span>
                        ) : null}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-1">
                    {rule.check === 'stale' ? (
                      <input
                        type="checkbox"
                        aria-label={`${name}: skip market holidays`}
                        checked={draft?.holidayAware ?? rule.holidayAware}
                        disabled={Boolean(readOnly) || saving}
                        onChange={(e) => set(rule, { holidayAware: e.target.checked })}
                      />
                    ) : null}
                  </td>
                  <td className="tabular px-3 py-1 font-mono text-muted-foreground">{rule.version}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {readOnly ? null : (
        <div className="flex flex-wrap items-center gap-3">
          <p role="status" data-slot="tolerance-impact" className="mr-auto">
            {edits.length === 0
              ? invalid
                ? 'Fix the threshold marked in red.'
                : 'Change a threshold to see what it would do to today’s prices.'
              : impact
                ? `On prices for ${formatIsoDate(impact.priceDate)}: ${impact.appear.toLocaleString('en-US')} ${impact.appear === 1 ? 'exception' : 'exceptions'} would appear and ${impact.clear.toLocaleString('en-US')} would clear (${impact.failingNow.toLocaleString('en-US')} failing now, ${impact.failingAfter.toLocaleString('en-US')} after).`
                : 'Working out what this would do to today’s prices…'}
          </p>
          <Button
            variant="ghost"
            disabled={Object.keys(drafts).length === 0 || saving}
            onClick={() => {
              setDrafts({});
              setImpact(null);
              setFailure(null);
            }}
          >
            Discard changes
          </Button>
          {/* Save waits for the preview: a rule is never changed without seeing its effect first. */}
          <Button disabled={edits.length === 0 || invalid || !impact || saving} onClick={() => void save()}>
            {saving
              ? 'Saving…'
              : `Save ${edits.length || ''} ${edits.length === 1 ? 'change' : 'changes'}`.replace('  ', ' ')}
          </Button>
        </div>
      )}
    </div>
  );
}
