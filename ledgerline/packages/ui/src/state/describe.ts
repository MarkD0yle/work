import type { ActionRef, Message, UiState } from '@ledgerline/contracts';

export type Tone = 'neutral' | 'info' | 'good' | 'warning' | 'critical';

export interface StateDescription {
  tone: Tone;
  /** Short status word shown with the icon, so status never relies on colour alone. */
  label: string;
  title: string;
  body?: string;
  messages?: Message[];
  actions?: ActionRef[];
  /** 0 to 1 when known. */
  progress?: number;
  busy?: boolean;
  /** True when the state replaces the content instead of sitting above it. */
  replacesContent: boolean;
}

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

const time = (iso: string) => {
  // Timestamps (not business dates) are shown in a fixed, unambiguous form.
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(iso);
  return m ? `${m[1]} ${m[2]} UTC` : iso;
};

const KIND_NAMES: Record<UiState['kind'], string> = {
  normal: 'normal',
  loading: 'loading',
  processing: 'processing',
  empty: 'empty',
  noMatches: 'no matches',
  warning: 'warning',
  blockingError: 'error',
  partialSuccess: 'partial success',
  permissionLimited: 'limited access',
  pendingApproval: 'pending approval',
  overridden: 'override',
  failedIntegration: 'failed integration',
  stale: 'stale data',
  conflict: 'conflict',
  recovery: 'recovery',
};

/** One description per UiState kind. Every surface (overlay, banner) renders from this, so wording stays consistent. */
export function describeState(state: UiState): StateDescription {
  switch (state.kind) {
    case 'normal':
      return { tone: 'neutral', label: 'Ready', title: 'Ready', replacesContent: false };
    case 'loading':
      return { tone: 'neutral', label: 'Loading', title: 'Loading…', busy: true, replacesContent: true };
    case 'processing':
      return {
        tone: 'info',
        label: 'Processing',
        title:
          state.progress === undefined ? 'Processing…' : `Processing… ${Math.round(state.progress * 100)}%`,
        body: state.jobId
          ? `Job ${state.jobId}. You can leave this screen; results stay in the job tray.`
          : 'This may take a moment.',
        busy: true,
        replacesContent: false,
        ...(state.progress === undefined ? {} : { progress: state.progress }),
      };
    case 'empty':
      return state.reason === 'notConfigured'
        ? {
            tone: 'neutral',
            label: 'Not set up',
            title: 'This is not set up yet',
            body: 'Ask an administrator to configure it.',
            replacesContent: true,
          }
        : {
            tone: 'neutral',
            label: 'Empty',
            title: 'Nothing here yet',
            body: 'There are no records to show.',
            replacesContent: true,
          };
    case 'noMatches':
      return {
        tone: 'neutral',
        label: 'No matches',
        title: 'No records match',
        body: `${plural(state.activeFilters, 'filter')} applied. Remove a filter or clear the search to see more.`,
        replacesContent: true,
      };
    case 'warning':
      return {
        tone: 'warning',
        label: 'Warning',
        title: plural(state.messages.length, 'warning'),
        body: 'You can acknowledge warnings and continue.',
        messages: state.messages,
        replacesContent: false,
      };
    case 'blockingError': {
      // One error: say it plainly (what happened, what to do, code). Several: a count, then the list.
      const only = state.messages.length === 1 ? state.messages[0] : undefined;
      return {
        tone: 'critical',
        label: 'Error',
        title: only ? only.text : `${plural(state.messages.length, 'error')} must be fixed`,
        messages: state.messages,
        replacesContent: true,
        ...(only?.fix ? { body: only.fix } : {}),
        ...(state.recovery ? { actions: state.recovery } : {}),
      };
    }
    case 'partialSuccess':
      return {
        tone: 'warning',
        label: 'Partial success',
        title: `${state.succeeded.toLocaleString('en-US')} succeeded, ${state.failed.toLocaleString('en-US')} failed, ${state.skipped.toLocaleString('en-US')} skipped`,
        body: `Job ${state.jobId}. Review the failed rows, fix them and retry only those.`,
        replacesContent: false,
      };
    case 'permissionLimited':
      return {
        tone: 'neutral',
        label: 'Limited access',
        title: 'You have limited access here',
        body: state.reason,
        replacesContent: true,
        ...(state.requestAccess ? { actions: [state.requestAccess] } : {}),
      };
    case 'pendingApproval':
      return {
        tone: 'info',
        label: 'Pending approval',
        title: state.approver ? `Waiting for ${state.approver.name} to approve` : 'Waiting for approval',
        body: `Requested ${time(state.since)}. Nothing changes until it is approved.`,
        replacesContent: false,
      };
    case 'overridden': {
      const p = state.provenance;
      return {
        tone: 'info',
        label: 'Overridden',
        title: p.overriddenBy ? `Overridden by ${p.overriddenBy.name}` : 'Value overridden',
        body: [
          p.overrideReason ? `Reason: ${p.overrideReason}` : null,
          p.originalValue ? `Original value ${p.originalValue}.` : null,
        ]
          .filter(Boolean)
          .join(' '),
        replacesContent: false,
      };
    }
    case 'failedIntegration':
      return {
        tone: 'critical',
        label: 'Connection failed',
        title: `${state.system} did not respond`,
        body: 'Your data here is unchanged. Retry, or carry on with other work.',
        replacesContent: true,
        ...(state.retry ? { actions: [state.retry] } : {}),
      };
    case 'stale':
      return {
        tone: 'warning',
        label: 'Stale',
        title: `Showing data as of ${time(state.asOf)}`,
        body: 'Newer data is available. Refreshing never overwrites unsaved edits.',
        actions: [state.refresh],
        replacesContent: false,
      };
    case 'conflict':
      return {
        tone: 'critical',
        label: 'Conflict',
        title: `${state.theirs.name} changed this record at ${time(state.at)}`,
        body: 'Your unsaved edits are kept. Choose how to continue.',
        actions: state.resolve,
        replacesContent: false,
      };
    case 'recovery':
      return {
        tone: 'good',
        label: 'Recovered',
        title: `Recovered from ${KIND_NAMES[state.from]}`,
        body: state.message,
        replacesContent: false,
      };
  }
}
