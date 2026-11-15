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
| POST | `/transactions` | Create. Body `TransactionCreate`: `{ portfolioId, securityId?, type, tradeDate, settleDate?, quantity?, price?, amount?, acknowledgedWarnings?, cloneOf? }`. Errors are a 422 with one message per field (`target` names the field). Warnings are a 422 with `needsAcknowledgement: [codes]`; send the codes back in `acknowledgedWarnings` to save through them. Saved as unposted; the amount of a buy, sell, repo or maturity is calculated. Audit action `transaction.create` or `transaction.clone`, with the acknowledgement as a note. Returns 201 `{ record, auditEventIds }` |
| PATCH | `/transactions/:id` | Edit (If-Match). Body `{ changes?: { quantity?, price?, amount? }, dates?: { tradeDate?, settleDate? }, reason? }`. A trade date in a period that is closed or closing for transactions is a 422 naming the period and who can reopen it; a settle date before the trade date is a 422. Unposted records only. Changing a calculated value is an override: needs `transaction.override` and a reason. Returns `{ record, auditEventIds }` |
| POST | `/transactions/eligibility` | `{ actionId, ids }` → `{ id, permission }[]`. A row that would be skipped is `allowed: false` with the reason (built) |
| POST | `/transactions/preview` | `{ actionId, ids }` → `PreviewRow[]` for the eligible rows: `before`, `after`, and `warnings` holding anything that would make the row fail plus the row's own warning. Changes nothing (built) |
| POST | `/transactions/bulk` | `{ actionId, ids, inputs?, reason? }` → `BulkResult`. Up to 200 ids run inline (200). More run as a job: the answer is 202 with `{ jobId, status: "queued" }` and empty lists; follow the job for the result. More than 5,000 is a 400. Posting a buy, sell, repo or maturity with no settlement date fails with `LL-VAL-0119`. Each row succeeds, fails with a message, or is skipped with a reason. A row already in the target state is skipped, so a retry cannot repeat it. Writes one audit event per row plus one for the batch, sharing `batchId` (returned as `jobId`) |

Bulk action ids: `transaction.post`, `transaction.reverse`, `transaction.delete` (built), `transaction.override` (Milestone 5; single-record override goes through PATCH).

### Market data
| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/prices/query` | Grid query → `PriceRow`: price, prior-day price, stored tolerance result and, when it fails, the `failedRule` (rule id, threshold, actual). Fields: `securityId`, `security`, `assetClass`, `priceDate`, `price`, `priorPrice`, `currency`, `source`, `toleranceStatus` |
| GET | `/prices/tolerances` | `ToleranceRule[]` |
| PUT | `/prices/tolerances` | `{ rules: [{ id, threshold, holidayAware? }] }`. Needs `tolerance.edit`. Each changed rule gets a new version and an audit event; the latest prices are then judged again |
| POST | `/prices/tolerances/impact` | Same body, saves nothing → `ToleranceImpact`: how many of the latest prices would start failing (`appear`) or stop failing (`clear`) |

How a price is judged: no price fails the `missing` rule; a move over the `dayOverDay` threshold is a variance; an unchanged price is stale, unless the rule is holiday-aware and the security's market was closed on the previous weekday (business rule 10). Price exceptions are resolved through `/exceptions/bulk`; there is no separate price-resolve endpoint.

### Cash, positions, reconciliation
| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/comparisons` | `{ kind: "books", portfolioId }` → `Comparison`: investment book against accounting book per security, with units and a tolerance (built) |
| POST | `/positions/query` | Grid query (not built) |
| POST | `/cash/query` | Grid query (not built) |

### Exceptions
| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/exceptions/query` | Grid query, oldest first by default. Fields: `id`, `type`, `severity` (sorts high to low), `status`, `portfolioId`, `portfolio`, `periodEnd`, `detectedAt`, `dueBy`, `ownerId`, `owner`, `rootCauseCategory`, `matchedRuleId`, `record`. Price exceptions carry `failedRule` |
| GET | `/exceptions/:id` | Detail with thread and evidence |
| POST | `/exceptions/:id/thread` | `{ text }` adds a comment (audited) |
| POST | `/exceptions/bulk` | `{ actionId, ids, inputs }` → `BulkResult`. Up to 1,000 ids. Closed exceptions are skipped with the reason |
| GET/POST | `/exceptions/rules` | Recurring-break rules. POST `{ name, match: { type, counterparty?, portfolioIds?, maxAmount? }, rootCauseCategory }`. Needs `exception.rules` |
| PUT/DELETE | `/exceptions/rules/:id` | Update, delete (audited) |
| POST | `/exceptions/rules/:id/apply` | Tags open, untagged exceptions the rule describes as proposals → `{ tagged }`. Resolves nothing |
| GET | `/exceptions/root-causes` | Team-maintained root-cause categories |

Bulk action ids and what `inputs` must carry:

| Action | Needs | Result |
| --- | --- | --- |
| `exception.assign` | `ownerId` | Owner set; `new` becomes `inProgress` |
| `exception.resolve` | `note`, `rootCauseCategory` | `resolved` |
| `exception.accept` | `note` | `resolved`, root cause "Accepted: …" |
| `exception.acceptConditionally` | `note`, `challengeRef` | `acceptedConditionally`, with the challenge as evidence |
| `exception.override` | `note` | `overridden` |
| `exception.escalate` | | Severity up one step; `waitingOnOthers` |
| `exception.attachEvidence` | `evidence: { name }` | The same evidence id on every exception. The file's content is not stored by the mock |
| `exception.acceptProposal` | | Resolves with the root cause the rule proposed. Exceptions with no proposal are skipped |

A missing input is a 422 naming the field. Every action writes one audit event per exception, with the note, plus one for the batch.

### Periods and close
| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/periods?portfolioId=` | `AccountingPeriod[]`, newest first |
| GET | `/calendars/:market` | `MarketCalendar`: holidays for a calendar code (e.g. `US`), for business-day rules |
| GET | `/periods/overview?periodEnd=&scope=` | `PeriodOverviewRow[]`: cutoff, checks passed, blocking count, status per close type, override status, sign-off. Default period is the latest that is not closed. `scope=mine` (default) is the portfolios the user controls; a user who controls none, or `scope=all`, gets every portfolio |
| GET | `/periods/:id/checklist` | `CloseChecklist`: the ten checks, the blocking exceptions by name, and any override, reopen or sign-off |
| POST | `/periods/close` | `{ portfolioIds, periodEnd, closeTypes? }` → 202 `Job` (`periodClose`), one result per portfolio. A portfolio with an open high-severity exception fails with `LL-CLS-0001`, naming up to five, unless a block override was approved. Needs `period.close` |
| POST | `/periods/:id/override-block` | `{ reason }` → 201 `ApprovalRequest` (pending). Needs `period.overrideBlock`. 409 when nothing is blocking or one is already waiting |
| POST | `/periods/reopen` | `{ periodId, closeTypes?, reason }` → 201 `ApprovalRequest` (pending). Needs `period.reopen`. Nothing reopens until a second person approves |
| POST | `/periods/:id/signoff` | `{ note? }` → `CloseSignOff`. Needs `period.signoff`; 409 unless every close type is closed |
| POST | `/periods/:id/package` | → 202 `Job` with two outputs: a PDF and an XLSX close package. 409 before sign-off |
| POST | `/periods/checks/run` | `{ periodEnd, portfolioIds? }` → `{ created, proposed }`. Runs the cash-to-custodian check: each unapplied receipt or outstanding wire becomes a cash break once. New breaks are offered to the recurring-break rules |

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
| POST | `/jobs/query` | Grid query. Fields: `id`, `type`, `status`, `name`, `submittedAt`, `submittedBy` (user id). Rows carry `counts` instead of `result`, and `inputs.rowCount` instead of `inputs.ids`. A client sees only their own jobs |
| GET | `/jobs/:id` | Detail: inputs, log, outputs, full `result` and `counts` |
| POST | `/jobs/:id/retry` | 202 with a new job that uses the original inputs. For row jobs it runs only the rows that failed or were never reached. 409 when nothing failed or the job is still running. Submitter or administrator only |
| POST | `/jobs/:id/cancel` | Stops a queued or running job. Rows already done stay done; the rest are untouched. 409 when it has finished |
| GET | `/jobs/:id/outputs/:idx` | Downloads an output file |
| GET | `/jobs/stream?user=<id>` | Server-sent events: one `job` event per change to one of that user's jobs (light form, with `counts`). The user is in the query only here, because a browser event stream cannot send headers |

How jobs run: in the API process, in chunks (`LL_JOB_CHUNK`, default 50 items) with a pause between chunks (`LL_JOB_TICK_MS`, default 150). The job row is saved after every chunk. On start-up, queued and running jobs carry on from the items not yet done, so nothing is done twice. A job runs as its submitter, with their permissions and scope at the time each chunk runs. Its id is the `batchId` on every audit event it writes.

### Reports
| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/reports` | The reports the user can run. Needs `report.run` |
| POST | `/reports/:id/run` | `{ asOf?, portfolioIds? }` → 202 `Job`. The job leaves one CSV output. A user with a blotter scope gets only their portfolios |

### Import
| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/imports/validate` | `{ mapping, rows }` → `ImportRowResult[]`, one per row, in order. Up to 10,000 rows. Transactions only for now |
| POST | `/imports/commit` | `{ mapping, rows, fileEvidence: { name }, acknowledgeWarnings? }` → `BulkResult` inline (`jobId` is the batch id). Re-validates. Any row with an error: 422 with the failing `rows`, and nothing is written. Rows with warnings: 422 with `needsAcknowledgement: true` until `acknowledgeWarnings` is sent. One audit event per row plus one for the batch, each with the file as evidence and `after.source: "imported"` |
| GET | `/imports/mappings/:targetType` | The signed-in user's last mapping for that target, or `null` |
| PUT | `/imports/mappings/:targetType` | Save a mapping. A successful commit saves its mapping too |

Import rules for transactions:
- Target fields: `id`, `portfolioId`, `securityId`, `type`, `tradeDate`, `settleDate`, `quantity`, `price`, `amount`.
- A row with an `id` corrects that unposted transaction; fields not mapped keep their current value. A row without an `id` creates a new unposted transaction.
- A security is found by internal id, ISIN, CUSIP, SEDOL or an unambiguous ticker. A portfolio by id or exact name.
- Dates read as `2026-11-13`, `13/11/2026`, `13.11.26`, `13 Nov 2026`. Numbers read with thousands separators, `(1,200)` as negative, and `1.5k`, `2m`, `1bn`.
- Every row goes through the same rules as `POST /transactions`.
- Message codes: `LL-IMP-0001` rows have errors, `0002` warnings need acknowledging, `0003` no rows, `0004` target type not available, `0010` empty row, `0011` no such transaction, `0012` not unposted, `0013` same transaction twice.

### Approvals
| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/approvals/query` | Grid query. Approvers see every request; everyone else sees the ones they made. Fields: `id`, `actionId`, `status`, `makerId`, `maker`, `requestedAt`, `record` |
| POST | `/approvals/:id/decide` | `{ decision: "approve" \| "reject", note? }`. Needs `approval.decide`. The maker gets a 403 `LL-APR-0001` (segregation of duties). A rejection needs a note. Approving a reopen reopens the period at once; approving a block override lets the close job through |
| POST | `/approvals/decide` | `{ ids, decision, note? }` → `BulkResult`. A request the caller made fails on its row with `LL-APR-0001` |

### Client
| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/statements` | Month-end statements in blotter scope, with download links |

### Audit
| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/audit/query` | Grid query, newest first. Fields: `id`, `action`, `recordType`, `recordId`, `actorId`, `actor`, `actorType`, `at`, `effectiveDate`, `batchId`. Needs `audit.view` (built) |
| GET | `/audit/record/:type/:id` | Timeline for one record: `AuditEvent[]`, newest first. Needs `audit.view` (built) |

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
