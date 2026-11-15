import type { AuditEvent, FilterCondition } from '@ledgerline/contracts';
import { AuditTimeline, describeAction, formatTimestamp, TaskChips, type TaskChip } from '@ledgerline/ui';
import {
  gridFeatures,
  LLGrid,
  type LLColumnDef,
  type LLDataSource,
  type LLGridHandle,
} from '@ledgerline/ui/grid';
import { useMemo, useRef, useState } from 'react';
import { SidePanel } from '../common/SidePanel';
import { queryAudit, type Me } from '../services';
import { ACTION_LABELS, FIELD_LABELS } from '../transactions/RecordHistory';

const ACTOR_TYPE: Record<AuditEvent['actor']['type'], string> = {
  user: 'User',
  system: 'System',
  job: 'Job',
  interface: 'Interface',
  external: 'External',
  agent: 'Agent',
};
const NOUN = { one: 'event', many: 'events' };

/**
 * The audit list (SPEC 7.10): every event, newest first, filterable by who, what and which record.
 * It is read only. Events are immutable, and nothing here can edit or delete one.
 */
export function AuditGrid({ me }: { me: Me }) {
  const grid = useRef<LLGridHandle>(null);
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [open, setOpen] = useState<AuditEvent | null>(null);
  const dataSource = useMemo<LLDataSource<AuditEvent>>(() => ({ kind: 'server', query: queryAudit }), []);
  const columns = useMemo<LLColumnDef<AuditEvent>[]>(
    () => [
      {
        field: 'at',
        header: 'When',
        type: 'text',
        width: 180,
        pinned: 'left',
        value: (e) => formatTimestamp(e.at),
      },
      {
        field: 'action',
        header: 'What',
        type: 'text',
        width: 240,
        groupable: true,
        value: (e) => describeAction(e.action, ACTION_LABELS),
      },
      {
        field: 'recordType',
        header: 'Record type',
        type: 'text',
        width: 130,
        groupable: true,
        value: (e) => e.recordRef.type,
      },
      {
        field: 'recordId',
        header: 'Record',
        type: 'text',
        mono: true,
        width: 170,
        value: (e) => e.recordRef.id,
      },
      {
        field: 'actor',
        header: 'Who',
        type: 'text',
        width: 220,
        value: (e) =>
          `${e.actor.name}${e.actor.onBehalfOf ? `, on behalf of ${e.actor.onBehalfOf.name}` : ''}`,
      },
      {
        field: 'actorType',
        header: 'Kind of actor',
        type: 'text',
        width: 130,
        groupable: true,
        value: (e) => ACTOR_TYPE[e.actor.type],
      },
      {
        field: 'effectiveDate',
        header: 'Effective',
        type: 'date',
        dateBasis: 'effective',
        width: 130,
        value: (e) => ({ value: e.effectiveDate ?? null, basis: 'effective' }),
      },
      {
        field: 'batchId',
        header: 'Batch',
        type: 'text',
        mono: true,
        width: 120,
        value: (e) => e.batchId ?? '',
      },
      {
        field: 'note',
        header: 'Note',
        type: 'text',
        width: 380,
        sortable: false,
        value: (e) => e.note?.text ?? '',
      },
      {
        field: 'immutable',
        header: 'Locked',
        type: 'boolean',
        width: 90,
        sortable: false,
        value: (e) => e.immutable,
      },
    ],
    [],
  );
  const chips = useMemo<TaskChip[]>(
    () => [
      { id: 'mine', label: 'By me', filter: { field: 'actorId', op: 'eq', value: me.user.id } },
      { id: 'periods', label: 'Periods', filter: { field: 'recordType', op: 'eq', value: 'period' } },
      {
        id: 'exceptions',
        label: 'Exceptions',
        filter: { field: 'recordType', op: 'eq', value: 'exception' },
      },
      {
        id: 'transactions',
        label: 'Transactions',
        filter: { field: 'recordType', op: 'eq', value: 'transaction' },
      },
      { id: 'approvals', label: 'Approvals', filter: { field: 'recordType', op: 'eq', value: 'approval' } },
    ],
    [me.user.id],
  );
  const features = useMemo(() => ({ ...gridFeatures(me.user.segment), selection: false }), [me.user.segment]);

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <TaskChips chips={chips} filters={filters} onChange={setFilters} />
        <LLGrid
          ref={grid}
          gridId="audit"
          label="Audit history"
          columns={columns}
          dataSource={dataSource}
          rowId={(e) => e.id}
          features={features}
          filters={filters}
          onFiltersChange={setFilters}
          filterLabels={{ actorId: 'Who', recordType: 'Record type' }}
          noun={NOUN}
          onRowOpen={setOpen}
        />
      </div>
      {open ? (
        <SidePanel
          label="Audit event"
          title={describeAction(open.action, ACTION_LABELS)}
          wide
          onClose={() => {
            const id = open.id;
            setOpen(null);
            setTimeout(() => grid.current?.focusRow(id), 0);
          }}
        >
          <div className="overflow-y-auto">
            <AuditTimeline
              events={[open]}
              actionLabels={ACTION_LABELS}
              fieldLabels={FIELD_LABELS}
              showRecord
            />
          </div>
        </SidePanel>
      ) : null}
    </div>
  );
}
