import { z } from 'zod'

/** Base shape every context must satisfy (FDC3 Context). */
export const BaseContextSchema = z
  .object({
    type: z.string().min(1),
    id: z.record(z.string(), z.unknown()).optional(),
    name: z.string().optional(),
  })
  .passthrough()

export type Context = z.infer<typeof BaseContextSchema>

export const SideSchema = z.enum(['BUY', 'SELL'])
export type Side = z.infer<typeof SideSchema>

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected ISO date (YYYY-MM-DD)')
const pair = z.string().regex(/^[A-Z]{6}$/, 'expected a six-letter currency pair')
const ccy = z.string().regex(/^[A-Z]{3}$/, 'expected a three-letter currency code')

export const PreTradeEstimateContextSchema = z.object({
  type: z.literal('harbor.preTradeEstimate'),
  id: z.object({ orderId: z.string().min(1) }),
  expectedCostBps: z.number(),
  recommendedMethod: z.enum(['RFQ', 'ALGO']),
  suggestedCounterparties: z.array(z.string()),
  liquidityScore: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
})
export type PreTradeEstimateContext = z.infer<typeof PreTradeEstimateContextSchema>

export const FxOrderContextSchema = z.object({
  type: z.literal('harbor.fxOrder'),
  id: z.object({ orderId: z.string().min(1) }),
  pair,
  side: SideSchema,
  dealtCurrency: ccy,
  amount: z.number().positive(),
  tenor: z.enum(['SPOT', 'TOM', '1W', '1M', '3M', 'BROKEN']),
  valueDate: isoDate,
  account: z.string().min(1),
  status: z.enum(['NEW', 'WORKING', 'PARTIAL', 'FILLED', 'CANCELLED']),
  benchmark: z.enum(['ARRIVAL', 'WMR_4PM', 'TWAP']).optional(),
  /**
   * Harbor addition: how the sender wants the order worked. Pre-Trade sets it
   * when raising `harbor.ExecuteOrder`, so the chosen method and the estimate
   * travel with the order instead of being re-keyed.
   */
  execution: z.object({ method: z.enum(['RFQ', 'ALGO']), estimate: PreTradeEstimateContextSchema.optional() }).optional(),
})
export type FxOrderContext = z.infer<typeof FxOrderContextSchema>

export const FxTradeContextSchema = z.object({
  type: z.literal('harbor.fxTrade'),
  id: z.object({ tradeId: z.string().min(1), orderId: z.string().min(1) }),
  pair,
  side: SideSchema,
  amount: z.number().positive(),
  rate: z.number().positive(),
  counterparty: z.string().min(1),
  method: z.enum(['RFQ', 'RFS', 'ALGO']),
  executedAt: z.string().datetime(),
  valueDate: isoDate,
  account: z.string().min(1),
  arrivalMid: z.number().positive(),
})
export type FxTradeContext = z.infer<typeof FxTradeContextSchema>

export const SettlementContextSchema = z.object({
  type: z.literal('harbor.settlement'),
  id: z.object({ tradeId: z.string().min(1) }),
  matchStatus: z.enum(['UNMATCHED', 'MATCHED', 'MISMATCHED', 'CONFIRMED', 'SETTLED', 'FAILED']),
  exceptionReason: z.string().optional(),
})
export type SettlementContext = z.infer<typeof SettlementContextSchema>

export const ORDER_STATUSES = ['NEW', 'WORKING', 'PARTIAL', 'FILLED', 'CANCELLED'] as const

/** Harbor addition: asks an order list to show a subset. Sent on the `harbor.orders` app channel. */
export const OrderFilterContextSchema = z.object({
  type: z.literal('harbor.orderFilter'),
  name: z.string().optional(),
  statuses: z.array(z.enum(ORDER_STATUSES)).optional(),
  pair: z.string().optional(),
})
export type OrderFilterContext = z.infer<typeof OrderFilterContextSchema>

/** Harbor addition, dev builds only: a test instruction from the shell's dev panel to an app. */
export const DevCommandContextSchema = z.object({
  type: z.literal('harbor.devCommand'),
  command: z.literal('forceMismatch'),
  /** The trade to break; omitted = the app picks its most recent healthy trade. */
  tradeId: z.string().optional(),
})
export type DevCommandContext = z.infer<typeof DevCommandContextSchema>

/* Standard FDC3 types used by Harbor. Kept loose (passthrough) because the
 * standard allows extra fields; only the fields Harbor reads are checked. */
export const InstrumentContextSchema = z
  .object({
    type: z.literal('fdc3.instrument'),
    id: z.record(z.string(), z.unknown()),
    name: z.string().optional(),
  })
  .passthrough()
export type InstrumentContext = z.infer<typeof InstrumentContextSchema>

export const PortfolioContextSchema = z
  .object({
    type: z.literal('fdc3.portfolio'),
    id: z.record(z.string(), z.unknown()).optional(),
    name: z.string().optional(),
    positions: z.array(z.unknown()),
  })
  .passthrough()
export type PortfolioContext = z.infer<typeof PortfolioContextSchema>

export const OrganizationContextSchema = z
  .object({
    type: z.literal('fdc3.organization'),
    id: z.record(z.string(), z.unknown()),
    name: z.string().optional(),
  })
  .passthrough()
export type OrganizationContext = z.infer<typeof OrganizationContextSchema>

export const TimeRangeContextSchema = z
  .object({
    type: z.literal('fdc3.timeRange'),
    startTime: z.string().datetime().optional(),
    endTime: z.string().datetime().optional(),
  })
  .passthrough()
  .refine((v) => v.startTime !== undefined || v.endTime !== undefined, {
    message: 'fdc3.timeRange needs startTime or endTime',
  })
export type TimeRangeContext = z.infer<typeof TimeRangeContextSchema>

const KNOWN: Record<string, z.ZodTypeAny> = {
  'harbor.fxOrder': FxOrderContextSchema,
  'harbor.fxTrade': FxTradeContextSchema,
  'harbor.preTradeEstimate': PreTradeEstimateContextSchema,
  'harbor.settlement': SettlementContextSchema,
  'harbor.orderFilter': OrderFilterContextSchema,
  'harbor.devCommand': DevCommandContextSchema,
  'fdc3.instrument': InstrumentContextSchema,
  'fdc3.portfolio': PortfolioContextSchema,
  'fdc3.organization': OrganizationContextSchema,
  'fdc3.timeRange': TimeRangeContextSchema,
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string }

export function formatIssues(error: z.ZodError): string {
  return error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ')
}

/**
 * Validate any context. Known types are checked against their full schema.
 * Unknown `harbor.*` types are rejected (the namespace is ours, so an unknown
 * one is a bug); other unknown types only need the base shape.
 */
export function validateContext(input: unknown): ValidationResult<Context> {
  const base = BaseContextSchema.safeParse(input)
  if (!base.success) return { ok: false, error: formatIssues(base.error) }
  const schema = KNOWN[base.data.type]
  if (!schema) {
    if (base.data.type.startsWith('harbor.')) {
      return { ok: false, error: `unknown Harbor context type "${base.data.type}"` }
    }
    return { ok: true, value: base.data }
  }
  const full = schema.safeParse(input)
  if (!full.success) return { ok: false, error: formatIssues(full.error) }
  return { ok: true, value: full.data as Context }
}

/** A short, human-readable id for log lines: the first id value, if any. */
export function contextIdLabel(context: Context): string {
  const first = context.id ? Object.values(context.id)[0] : undefined
  return typeof first === 'string' || typeof first === 'number' ? String(first) : ''
}
