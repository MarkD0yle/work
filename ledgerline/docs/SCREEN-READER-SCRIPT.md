# Screen-reader script

A manual check for the two proof journeys (PLAN 7.4). Automated checks (axe on every route and story) find missing names and roles. They cannot tell you whether the journey makes sense by ear. This script does.

**Status: written, not yet run with a person.** Run it with NVDA + Firefox and VoiceOver + Safari before any capability moves past `Hypothesis`. Log what you find in `docs/EVIDENCE.md`.

## How to run it

1. `pnpm db:reset && pnpm dev`. Open `http://localhost:5310`.
2. Turn the screen reader on. Put the mouse away.
3. Follow each step. Tick it only if you hear what is in the "You should hear" column, or words that mean the same.
4. If a step fails, write down what you heard instead.

## Journey 1: Transaction Workbench (Ada)

Sign in: tab to "Signed-in user" in the top bar and choose **Ada · Super user**.

| # | Do | You should hear |
| --- | --- | --- |
| 1 | Press `g` then `t` | "Transactions", heading level 1 |
| 2 | Wait | "Transactions: about 5,000 rows, 10 columns" |
| 3 | Tab to the view button | "Yesterday's unposted trades", button, and that it opens a menu |
| 4 | Tab to the filter tags | A list "Active filters" with "Status is unposted" and "Trade date is yesterday", each with a remove button |
| 5 | Tab into the grid, press Down | A row: transaction id, status, type, dates with their basis ("trade", "settle"), amounts with currency |
| 6 | Move to an amount cell | The number, the currency, and "calculated" where it applies. Never just "blank": a missing value says "Missing" |
| 7 | Press Enter on a row | Focus moves to "Transaction T-…", heading. The panel is a complementary region "Transaction detail" |
| 8 | Tab through the panel | Each field with its label. A posted record says "Read only" and why |
| 9 | Open the History tab | A list "History, newest first". Each item: what happened, who, when, and "changed to" between old and new values. "Locked" on each |
| 10 | Press Escape | Focus returns to the row you opened |
| 11 | Press Space, then tab to the selection bar | "1 selected", then "Actions for selected transactions" with Post, and "More actions" |
| 12 | On a posted row, focus Reverse as Ben | "Reverse", unavailable, and the reason in full |
| 13 | Press Ctrl+Enter on an unposted row | A dialog "Post 1 transaction?", the description, "This can be reversed later", and focus on the Post button |
| 14 | Press Enter | "Post: done, 1 transaction" |
| 15 | Activate "Paste or import" | A dialog "Paste or import transactions", then "Paste rows here", edit text |
| 16 | Paste rows with one bad quantity | The table "Rows to import". The bad cell: "Quantity, row N", invalid entry, and the message "Quantity … is not a number" with what to do |
| 17 | Tab to the summary and the Import button | "N rows: … valid, … warnings, 1 error". The button is unavailable and the reason is read: "Fix or exclude the 1 row with errors first" |
| 18 | Fix the cell, tab away | The summary changes to "0 errors" and the status says "Ready" |
| 19 | Activate "New transaction", save it empty | "N fields need fixing", then on each field its own message: "Portfolio is required." and so on |
| 20 | Open Jobs in the top bar | "Jobs", with how many are running or finished and not yet opened |

## Journey 2: Period Close (Cleo, with Fay approving)

Sign in as **Cleo · Controller**.

| # | Do | You should hear |
| --- | --- | --- |
| 1 | Press `g` then `a` | "Accounting", heading level 1, then a navigation "Accounting sections" |
| 2 | Wait | "Nov 2026. 20 portfolios: … closed, … blocked." |
| 3 | Move through a row | Portfolio, "23 days left" and the cutoff date, "7 of 10" checks passed, "2 high severity" or "Nothing blocking", then each close type with its state in words |
| 4 | Press Enter on a blocked row | Focus on the portfolio name, heading. Region "Close detail" |
| 5 | Tab to "Blocking exceptions" | "Close is blocked by N high-severity exceptions", then each one: id, what it is, owner |
| 6 | Tab to the checklist | A table "Close checklist": each check, "Passed", "Open items" or "Blocked", and the count |
| 7 | Tab to "Close this portfolio" | Unavailable. The list after the buttons reads "Close: Blocked by N high-severity exceptions, listed above." |
| 8 | Activate "Request block override…" | A dialog with what an override does and that it needs a second approver. "Reason (required)", edit text |
| 9 | Submit it empty | "Enter the reason. It is recorded in the audit history." |
| 10 | Enter a reason, submit | "Sent for approval". Back in the panel: "Waiting for approval" with since when |
| 11 | Go to Approvals, open your request | Approve and Reject are unavailable, and the page says why: "You made this request… segregation of duties" |
| 12 | As Fay: Approvals, open the request | Status "Waiting", who asked and when, the reason, and what will change |
| 13 | As Fay: Approve, add a note | "Approve: done" |
| 14 | As Cleo: reopen the portfolio, close it | "Block override approved by Fay", then "Closed" |
| 15 | Activate "Sign off…", submit | "Signed off", and the sign-off line reads "Cleo" and the time |
| 16 | Activate "Create close package" | "Producing the close package…", then "Close package ready" with "Download PDF" and "Download XLSX" |
| 17 | Open the Books tab | "N compared. M outside the 0.5% tolerance." Each row: both values, the difference, and "Within", "Near limit" or "Breach" |
| 18 | Open the History tab | Closed, Block override approved, Block override requested, each with who and the reason |
| 19 | Go to Exceptions, press Enter on a row | Region "Exception detail": status and severity as words, the rule that failed for a price, evidence, and the thread |
| 20 | Activate Resolve, submit without a root cause | "Resolve needs a root cause." with what to do, beside the fields |

## What to watch for

- **Silence.** Any step where nothing is announced after an action.
- **Colour words.** Any state described only as red, amber or green.
- **Lost focus.** Focus landing on the page body after a dialog or panel closes.
- **Repetition.** The same long text read on every row. Note it: it slows people down.
- **Order.** A reason read before the control it explains, or far from it.
