# Bug Report Samples — NimbusDesk

Example defect reports written to the standard the team uses in the tracker. These illustrate reporting quality; the scenarios are representative of the platform under test.

---

## BUG-101 — Subscription stays "trial" after successful payment when the plan is "business"

- **Environment:** Staging · Chrome 126 / Windows 11 · build 2.4.1
- **Severity:** Critical (revenue-impacting)
- **Priority:** P1
- **Steps to reproduce:**
  1. Create a fresh account and log in.
  2. Open `/billing`, select plan **Business — $79/month**.
  3. Pay with the simulated success card `4242 4242 4242 4242`.
  4. Open `/dashboard`.
- **Expected result:** Payment confirmation shown; dashboard badge reads `active` with plan `business`.
- **Actual result:** Payment confirmation is shown, but the dashboard badge still reads `trial`; `/reports` remains blocked. `GET /api/subscriptions/me` returns `status: "trial"`.
- **Evidence:** `evidence/BUG-101-dashboard-trial.png`, HAR `evidence/BUG-101-checkout.har`
- **Notes:** Reproduces 5/5 with plan `business`; does **not** reproduce with plan `pro` — suspect plan-mapping in the checkout handler.

---

## BUG-102 — Team page leaks other tenant's user emails via URL manipulation

- **Environment:** Staging · Firefox 127 / macOS 14 · build 2.4.1
- **Severity:** Blocker (security / data leakage)
- **Priority:** P1
- **Steps to reproduce:**
  1. Log in as `alice.admin@acme-test.io` (Acme tenant).
  2. Manually navigate to `/team?tenant=globex`.
- **Expected result:** HTTP 403 with an access-denied message; no Globex data rendered.
- **Actual result:** Page returns 200 and renders the full Globex member table, including names and email addresses.
- **Evidence:** `evidence/BUG-102-cross-tenant-team.png`, `evidence/BUG-102-response.har`
- **Notes:** Also reproducible via `GET /api/tenants/globex/users` with an Acme token → API returns 200. Escalated to security; suggested regression test added as TC-TEN-001 / TC-API-TEN-002.

---

## BUG-103 — Declined payment shows a raw gateway error instead of a user-friendly message

- **Environment:** Staging · Chrome 126 / Android 14 (mobile web) · build 2.4.0
- **Severity:** Major (UX on a P1 flow)
- **Priority:** P2
- **Steps to reproduce:**
  1. Log in with a trial account and open `/billing`.
  2. Submit the simulated declined card `4000 0000 0000 0002`.
- **Expected result:** Friendly error: "Your card was declined. Please use a different payment method." Form remains filled except card fields.
- **Actual result:** Page shows `Error: charge_failed (code 402) at gateway.ts:88` and the whole form is cleared, forcing the user to re-enter everything.
- **Evidence:** `evidence/BUG-103-raw-error-mobile.png`
- **Notes:** Message exposes an internal file path — flagged as minor information disclosure too.

---

## BUG-104 — Session not invalidated after logout; Back button re-opens the dashboard

- **Environment:** Production-like (UAT) · Edge 126 / Windows 11 · build 2.4.1
- **Severity:** Major (security)
- **Priority:** P1
- **Steps to reproduce:**
  1. Log in as any user and open `/dashboard`.
  2. Click **Log out** (redirects to `/login`).
  3. Press the browser **Back** button.
  4. Refresh the page.
- **Expected result:** Both the Back navigation and the refresh land on `/login`; the dashboard is never rendered again with the old session.
- **Actual result:** The Back button shows the fully rendered dashboard from cache; refreshing keeps the user on `/dashboard` — the server still accepts the old session cookie.
- **Evidence:** `evidence/BUG-104-back-button.mp4`
- **Notes:** Cookie is cleared client-side but the session token is not deleted server-side. Shared-computer risk.

---

## BUG-105 — Duplicate-email check is case-sensitive, allowing duplicate accounts

- **Environment:** Staging · API (Postman/Playwright request) · build 2.4.1
- **Severity:** Minor (data quality, support burden)
- **Priority:** P3
- **Steps to reproduce:**
  1. `POST /api/users` with `email: "casetest@example-test.io"` → 201.
  2. `POST /api/users` with the same payload but `email: "CaseTest@Example-Test.io"`.
- **Expected result:** Second request rejected with 409 `duplicate_email`.
- **Actual result:** Second request returns 201 and creates a second user and a second tenant; the user can now log in to two different workspaces depending on the email casing used.
- **Evidence:** `evidence/BUG-105-duplicate-accounts.json`
- **Notes:** Emails should be normalized to lowercase before uniqueness checks (RFC 5321 local parts are technically case-sensitive, but product policy treats emails as case-insensitive).

---

## BUG-106 — Payment timeout retries create two active subscriptions

- **Environment:** Staging · Chrome 126 / Windows 11 · build 2.4.2-rc1
- **Severity:** Critical (double-charge risk)
- **Priority:** P1
- **Steps to reproduce:**
  1. Log in with a trial account; open `/billing`.
  2. Pay with the timeout card `4000 0000 0000 0119` → timeout error shown.
  3. Immediately retry with the success card `4242 4242 4242 4242`.
  4. Inspect `GET /api/subscriptions/me` and the billing history.
- **Expected result:** Exactly one active subscription; the timed-out attempt is either voided or reconciled before the retry is charged.
- **Actual result:** Billing history shows two charges and two subscription rows (`active`, `active`) for the same tenant.
- **Evidence:** `evidence/BUG-106-double-subscription.png`, `evidence/BUG-106-billing-history.json`
- **Notes:** Needs an idempotency key on checkout requests. Regression candidate for the automated API suite.
