# Ledgerline API Contract (mock accounting engine)

This is the contract the UI depends on. In this build it is implemented by `apps/api` against SQLite. Later it is the document to negotiate with the real engine's owners. **Keep it stable; change it only with a note in `docs/DECISIONS.md`.**

## Conventions

- Base path `/api/v1`. JSON. Zod schemas in `apps/api/src/schemas` mirror `@ledgerline/contracts`.
- Auth in dev: header `X-LL-User: <userId>` set by the role switcher. Every endpoint enforces permissions server-side.
- Decimals are strings. Business dates are ISO `YYYY-MM-DD`. Timestamps are ISO with timezone.
- Legacy placeholders (`1900-01-01`, `9999-12-31`, `0001-01-01`) are converted to `null` at the boundary.
- Errors: `{ messages: Message[] }` with HTTP 400 (validation), 403 (permission, includes `Permission` with explanation), 409 (conflict or stale version), 422 (business rule, e.g. closed period).
- Optimistic concurrency: mutable records carry `version`; writes send `If-Match: <version>`. Mismatch returns 409 with the current record.
- Every mutation returns the audit event ids it wrote.
- Relative date filters (`today`, `yesterday`, …) resolve against the engine's business date, not the caller's clock. `yesterday` is the previous business day. In the mock the engine date is the seed date (`LL_TODAY` overrides it).
- Grid queries: sort and filter fields come from a per-endpoint whitelist; an unknown field is a 400. A page is at most 1,000 rows.
- Grouping: when `groupBy` is longer than `groupKeys`, the response is a group level: `rows` is empty and `groups` holds `{ field, key, count }` per value, ordered by value, with `totalRows` the number of groups. `groupKeys` pin the levels already opened; when they cover every `groupBy` field, records are returned as usual.

## Server-side grid query

All list endpoints accept the same query body (POST `/…/query`) so the AG Grid server-side row model can drive them:

```json
{
  "startRow": 0,
  "endRow": 100,
  "sort": [{ "field": "tradeDate", "dir": "desc" }],
  "filters": [ /* FilterCondition[] */ ],
  "quickSearch": "AAPL",
  "groupBy": ["portfolioId"],
  "groupKeys": []
}
```

Response:

```json
{ "rows": [], "totalRows": 104233, "asOf": "2026-11-14T16:00:00Z" }
```

## Endpoints

### Session and permissions
| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/me` | Current user, role, default density, workspaces to load at startup (the user's own before the team default), and `businessDate`: the engine's business date, which date shortcuts and relative filters count from |
| GET | `/me/permissions` | `Permission[]` for every action, with explanations |
| GET | `/users` | Seeded users (dev role switcher) |

### Entities
| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/entities/search?kind=&q=&scope=&includeInactive=&type=&currency=` | Entity Picker search → `EntitySearchResult[]` (at most 50). Exact identifier matches first, with `matchedOn`. Restricted records returned with `restricted: { reason }`. `scope=held` limits securities to held ones. `type` and `currency` are criteria; with either, `q` may be empty. Searchable kinds: portfolio, security, manager, report (others: 400) |
| GET | `/entities/recent?kind=` | Last 10 used, most recent first |
| POST | `/entities/recent` | `{ kind, id }` records a pick (204) |
| POST | `/portfolios/query` · `/securities/query` | Grid queries |
| GET | `/portfolios/:id` · `/securities/:id` | Detail |

### Transactions
| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/transactions/query` | Grid query |
| GET | `/transactions/:id` | Detail with financial values and provenance |
| POST | `/transactions` | Create (validates; may return warnings to acknowledge) |
| PATCH | `/transactions/:id` | Edit (If-Match). Body `{ changes?: { quantity?, price?, amount? }, dates?: { tradeDate?, settleDate? }, reason? }`. A trade date in a period that is closed or closing for transactions is a 422 naming the period and who can reopen it; a settle date before the trade date is a 422. Unposted records only. Changing a calculated value is an override: needs `transaction.override` and a reason. Returns `{ record, auditEventIds }` |
| POST | `/transactions/eligibility` | `{ actionId, ids }` → per-row `Permission` |
| POST | `/transactions/preview` | `{ actionId, ids, inputs }` → `PreviewRow[]` |
| POST | `/transactions/bulk` | `{ actionId, ids, inputs?, reason? }` → `BulkResult` inline. At most 200 ids for now (more is a 400 until jobs arrive in Milestone 5). Each row succeeds, fails with a message, or is skipped with a reason. A row already in the target state is skipped, so a retry cannot repeat it. Writes one audit event per row plus one for the batch, sharing `batchId` (returned as `jobId`) |

Bulk action ids: `transaction.post`, `transaction.reverse`, `transaction.delete` (built), `transaction.override` (Milestone 5; single-record override goes through PATCH).

### Market data
| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/prices/query` | Grid query with tolerance status per price |
| GET/PUT | `/prices/tolerances` | Tolerance rules by asset class, currency, source (versioned, audited) |
| POST | `/prices/tolerances/impact` | Proposed rules → count of exceptions that would appear or clear |
| POST | `/prices/bulk-resolve` | `{ ids, resolution, reason }` |
| POST | `/prices/:id/resolve` | `{ resolution: 'accept' \| 'acceptConditionally' \| 'override', value?, challengeRef?, reason }` |

### Cash, positions, reconciliation
| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/positions/query` | Grid query |
| POST | `/cash/query` | Grid query |
| POST | `/comparisons` | `{ left: Source, right: Source, keys, tolerances }` → aligned rows with deltas |

### Exceptions
| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/exceptions/query` | Grid query |
| GET | `/exceptions/:id` | Detail with thread and evidence |
| POST | `/exceptions/:id/thread` | Add comment |
| POST | `/exceptions/:id/evidence` | Attach evidence (multipart) |
| POST | `/exceptions/bulk` | Assign, resolve, accept, override, escalate, attach evidence |
| GET/POST | `/exceptions/rules` | Recurring-break rules: match pattern, root-cause category, proposed resolution |
| PUT/DELETE | `/exceptions/rules/:id` | Update, delete (audited) |
| GET | `/exceptions/root-causes` | Team-maintained root-cause categories |

### Periods and close
| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/periods?portfolioId=` | `AccountingPeriod[]`, newest first |
| GET | `/calendars/:market` | `MarketCalendar`: holidays for a calendar code (e.g. `US`), for business-day rules |
| GET | `/periods/:id/checklist` | Close checks with status and exception counts |
| POST | `/periods/close` | `{ portfolioIds, periodEnd, closeTypes }` → `{ jobId }` |
| POST | `/periods/reopen` | `{ periodId, closeTypes, reason }` (creates an approval request) |
| GET | `/periods/overview?periodEnd=` | All owned portfolios: cutoff, checks passed, blocking counts, status per close type, sign-off |
| POST | `/periods/:id/override-block` | `{ reason }` → approval request |
| POST | `/periods/:id/signoff` | `{ note }` |
| POST | `/periods/:id/package` | → `{ jobId }`; outputs PDF and XLSX close package |

### Views and workspaces
| Method | Path | Purpose |
| --- | --- | --- |
| GET/POST | `/views?gridId=` | List (default, then shared, then the caller's personal views; never other people's personal views), create |
| PUT/DELETE | `/views/:id` | Update and delete: owner or administrator only (403 otherwise, telling the user to save a copy). `owner` in the body reassigns ownership. The default view cannot be deleted |
| GET/POST | `/workspaces` | List (the caller's own plus their team's defaults), create |
| PUT/DELETE | `/workspaces/:id` | Update, delete: owner or administrator only |

### Jobs
| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/jobs/query` | Grid query |
| GET | `/jobs/:id` | Detail with log, outputs, results |
| POST | `/jobs/:id/retry` | Retry failed rows with original inputs |
| POST | `/jobs/:id/cancel` | Cancel |
| GET | `/jobs/stream` | Server-sent events for job progress |

### Import
| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/imports/validate` | `{ mapping, rows }` → `ImportRowResult[]` |
| POST | `/imports/commit` | `{ mapping, rows, fileEvidence }` → `{ jobId }` |

### Approvals
| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/approvals/query` | Queue for the current approver |
| POST | `/approvals/decide` | `{ ids, decision: 'approve' \| 'reject', note }` |

### Client
| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/statements` | Month-end statements in blotter scope, with download links |

### Audit
| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/audit/query` | Grid query |
| GET | `/audit/record/:type/:id` | Timeline for one record |

### Reports (mock)
| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/reports` | Report definitions |
| POST | `/reports/:id/run` | `{ params }` → `{ jobId }`; output is CSV/XLSX generated from SQLite |

## Business rules the mock must enforce

1. Cannot post into a closed period (422, names period and reopen role).
2. Cannot reverse an unposted transaction; cannot delete a posted one.
3. Ben (new user) cannot reverse: 403 with explanation.
4. Eli (client) sees only portfolios in blotter scope; others return as restricted.
5. Overrides require a reason; audit stores the original value.
6. Close is blocked while high-severity exceptions are open for that portfolio and period, unless a user with `period.overrideBlock` supplies a reason and a second user approves.
9. A user cannot approve their own request (403, segregation of duties).
10. Stale-price checks skip the security's market holidays.
7. About 2% of bulk posts fail with realistic messages (missing price, settlement date before trade date, insufficient position) so partial success is always exercised.
8. Jobs persist; a restarted API resumes queued jobs and marks interrupted running jobs as failed with a retry.

## Seed data

Deterministic with a fixed faker seed. Shaped generators, not random noise.

| Entity | Volume | Shape notes |
| --- | --- | --- |
| Portfolios | 60 | Insurance general account, separate accounts, funds; base currencies USD, EUR, GBP, JPY |
| Securities | 1,000,000 (searchable index) / 20,000 held | Govts, corporates, munis, MBS/TBA, equities, futures, swaps, FX forwards; ISIN/CUSIP/SEDOL/ticker |
| Transactions | 250,000 | Buys, sells, income, corporate actions, repo, margin; 5% unposted; 2% with warnings |
| Prices | 20,000 per day × 30 days | 3% stale, 1% variance breaches, 0.5% missing |
| Cash activity | 50,000 | 1% unapplied, some outstanding wires |
| Periods | 12 months × 60 portfolios | Current month open, prior closed, one reopened |
| Exceptions | Generated by checks | Mix of all `ExceptionType`s, severities and owners |
| Users | 7 | See `SPEC.md` §3 |

If an internal financial mock-data generator is available (for example an MCP server with shaped FX and position generators), the seed module may call it, but the default seed must run offline.
