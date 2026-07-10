# Test Plan — NimbusDesk (Simulated Multi-Tenant SaaS Platform)

| Field | Value |
| --- | --- |
| Document version | 1.0 |
| Author | QA / SDET |
| Application under test | NimbusDesk — simulated multi-tenant SaaS platform |
| Test level | System / E2E / API / UAT |

## 1. Scope

### In scope
- User onboarding (account + workspace creation, field validation)
- Authentication (login, logout, session handling, protected routes)
- Subscription and payment flows (simulated gateway: approved, declined, timeout, invalid input)
- Multi-tenant access control (tenant isolation, role-based access: admin vs member)
- Public JSON API (users, auth, subscriptions, tenant users) — status codes, response bodies, contracts, 401/403 behaviour
- Regression coverage via automated Playwright suites in CI

### Out of scope
- Real payment provider integration (all payments are simulated with test cards)
- Performance/load testing
- Localization
- Native mobile apps (see §9 — the framework is structured for future mobile automation)

## 2. Objectives
1. Verify that new customers can onboard, subscribe and use the platform without defects in critical paths.
2. Prove tenant isolation: no user can read or manage another tenant's data.
3. Validate the API contract so client integrations do not break silently.
4. Provide fast regression feedback on every push via CI.

## 3. Features covered

| Feature | Manual test cases | Automated E2E | Automated API |
| --- | --- | --- | --- |
| Onboarding | TC-ONB-* | `tests/e2e/onboarding.spec.ts` | `tests/api/users-api.spec.ts` |
| Authentication | TC-AUTH-* | `tests/e2e/auth.spec.ts` | `tests/api/auth-api.spec.ts` |
| Payments & subscription | TC-PAY-* | `tests/e2e/subscription-payment.spec.ts` | `tests/api/subscription-api.spec.ts` |
| Multi-tenant access | TC-TEN-* | `tests/e2e/multi-tenant.spec.ts` | `tests/api/tenant-api.spec.ts` |

## 4. Test types
- **Functional E2E (automated)** — user-visible flows through the browser (Playwright, Chromium).
- **API testing (automated)** — request-level checks with the Playwright request context: status codes, bodies, JSON contract, auth failures.
- **Manual exploratory & scripted testing** — see [test-cases.md](test-cases.md) and [edge-cases.md](edge-cases.md).
- **UAT** — business validation checklist in [uat-checklist.md](uat-checklist.md).
- **Negative testing** — invalid input, declined/timed-out payments, forged tokens, cross-tenant attempts.

## 5. Entry criteria
- Application build deployed and reachable in the test environment.
- Seed data loaded (tenants `acme`, `globex` and their users from `data/`).
- Test environment healthy (`GET /login` returns 200).
- Automated suite compiles (`npx tsc --noEmit` clean).

## 6. Exit criteria
- 100% of automated E2E and API tests pass in CI.
- All Critical/High manual test cases executed with no open Critical/High defects.
- UAT checklist signed off by the business stakeholder.
- Known Medium/Low defects documented and triaged.

## 7. Risks and mitigation
See [risk-analysis.md](risk-analysis.md) for the full register. Highest ranked:
1. Cross-tenant data leakage — mitigated by dedicated isolation suites (UI + API).
2. Payment failures charging users without activating subscriptions — mitigated by decline/timeout scenarios asserting final state.
3. API contract drift breaking integrations — mitigated by schema assertions on every endpoint.

## 8. Tools
- **Playwright** + **TypeScript** — E2E and API automation
- **Playwright HTML report + list reporter** — reporting
- **GitHub Actions** — CI/CD, report artifacts
- **Markdown docs in `docs/`** — manual test assets

## 9. Test environment
- Local: mock SaaS server started automatically by Playwright (`http://127.0.0.1:3100`), in-memory state reset per run.
- CI: `ubuntu-latest`, Node 20, Chromium; identical seed data — fully deterministic.
- **Mobile readiness:** the suite uses Playwright device descriptors, so mobile-web coverage is one config entry away (e.g. `devices['Pixel 7']`); page-object-style helpers in `tests/helpers/` keep flows reusable for a future Appium/mobile layer.

## 10. Deliverables
- Automated suites (`tests/e2e`, `tests/api`) + CI pipeline
- Manual test cases, UAT checklist, edge cases, bug report samples, risk analysis (`docs/`)
- Playwright HTML report per run (CI artifact)
