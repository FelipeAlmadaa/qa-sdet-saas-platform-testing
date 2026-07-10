# Risk Analysis — NimbusDesk

Risk score = Likelihood (1–3) × Impact (1–3). Anything scoring ≥ 6 must have automated regression coverage before release.

| ID | Risk | Likelihood | Impact | Score | Mitigation / test coverage |
| --- | --- | --- | --- | --- | --- |
| R-01 | **Data leakage between tenants** — a user reads or manages another company's data via UI URLs or API calls | 2 | 3 | **6** | Dedicated isolation suites at UI (`multi-tenant.spec.ts`) and API (`tenant-api.spec.ts`) level; every list response asserted to contain only same-tenant records; 403 contract checks; security-focused edge cases EC-10…EC-13 |
| R-02 | **Payment failures handled incorrectly** — user charged without activation, or activated without payment | 2 | 3 | **6** | Decline, timeout and invalid-card scenarios assert the *final* subscription state, not just the message (`subscription-payment.spec.ts`, `subscription-api.spec.ts`); timeout asserted as state-preserving so retries are safe |
| R-03 | **Regression in the subscription flow** — a release silently breaks activation or access gating | 2 | 3 | **6** | Full E2E + API payment suite runs in CI on every push/PR; premium-content gating (trial → blocked, active → allowed) asserted end-to-end |
| R-04 | **Unauthorized access** — protected pages/endpoints reachable without a valid session or token | 2 | 3 | **6** | Route-protection sweep (TC-AUTH-005), logout invalidation (TC-AUTH-004), forged/missing token checks on every API group (401 contract) |
| R-05 | **Broken onboarding** — new customers cannot sign up, killing acquisition | 1 | 3 | **3** | Happy path + all validation branches automated (`onboarding.spec.ts`, `users-api.spec.ts`); onboarding is the first suite in CI so failures surface immediately |
| R-06 | **API contract changes** — response shape drift breaks client integrations without failing tests | 2 | 2 | **4** | Schema assertions (`tests/helpers/schema.ts`) on every endpoint: field presence + types for success bodies and the `{error:{code,message}}` failure contract |
| R-07 | **Sensitive data exposure in API responses** — password or internal fields leak | 1 | 3 | **3** | Explicit `not.toHaveProperty('password')` assertions on all user-returning endpoints |
| R-08 | **Role-escalation** — a member performs admin actions inside their own tenant | 1 | 3 | **3** | Role-based checks in UI (invite form hidden) and API (`forbidden_role` 403) |
| R-09 | **Environment flakiness** — shared mutable state makes tests intermittently fail, eroding trust in CI | 2 | 2 | **4** | Payment tests provision an isolated user/tenant each; unique emails per test; in-memory SUT reset per run; traces/screenshots on failure for triage |

## Monitoring the register
- Reviewed at every release planning session; scores re-evaluated when architecture changes (e.g. a real payment provider replaces the simulator).
- Any production incident maps back to a risk ID; if none fits, a new risk is added with regression tests before the fix ships.
