# QA/SDET Portfolio — SaaS Platform Testing

![Playwright](https://img.shields.io/badge/Playwright-2EAD33?logo=playwright&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?logo=githubactions&logoColor=white)
![QA Automation](https://img.shields.io/badge/QA-Automation-8A2BE2)
![API Testing](https://img.shields.io/badge/API-Testing-FF6C37)

> **QA/SDET portfolio project**: complete manual + automated testing of **NimbusDesk**, a simulated multi-tenant SaaS platform with onboarding, authentication, subscription payments and tenant isolation. The mock application ships inside the repo, so the entire suite runs locally and in CI with zero external dependencies — and zero real credentials.

---

## 📋 Project overview

This project demonstrates how I approach quality for a real SaaS product, end to end:

- **Automated E2E testing** (Playwright + TypeScript) of the critical user journeys
- **API testing** with Playwright's request context — status codes, response bodies, JSON contract, 401/403 authorization
- **Manual test engineering** — test plan, scripted test cases, edge cases, UAT checklist, bug reports, risk analysis (in [`docs/`](docs/))
- **CI/CD** — GitHub Actions pipeline running the full suite on every push, publishing the HTML report as an artifact

The system under test is a self-contained mock SaaS app ([`mock-server/`](mock-server/)) that Playwright boots automatically. Payments use **simulated test cards only** (Stripe test-card convention) — no real payment data anywhere.

## ✅ Tested features

| Feature | E2E suite | API suite |
| --- | --- | --- |
| User onboarding (validation, redirect, duplicates) | [`tests/e2e/onboarding.spec.ts`](tests/e2e/onboarding.spec.ts) | [`tests/api/users-api.spec.ts`](tests/api/users-api.spec.ts) |
| Login, logout & session protection | [`tests/e2e/auth.spec.ts`](tests/e2e/auth.spec.ts) | [`tests/api/auth-api.spec.ts`](tests/api/auth-api.spec.ts) |
| Subscription & payments (success, declined, timeout, blocked access) | [`tests/e2e/subscription-payment.spec.ts`](tests/e2e/subscription-payment.spec.ts) | [`tests/api/subscription-api.spec.ts`](tests/api/subscription-api.spec.ts) |
| Multi-tenant isolation & role-based access | [`tests/e2e/multi-tenant.spec.ts`](tests/e2e/multi-tenant.spec.ts) | [`tests/api/tenant-api.spec.ts`](tests/api/tenant-api.spec.ts) |

## 🎯 Test strategy

1. **Risk-based prioritization** — coverage is driven by the [risk register](docs/risk-analysis.md): tenant data leakage, payment correctness and unauthorized access rank highest and get both UI- and API-level automation.
2. **Test the state, not just the message** — payment tests assert the *final subscription state* (e.g. a declined card must leave the tenant `past_due` and block premium content), not only that an error appeared.
3. **Isolated, parallel-safe tests** — every payment test provisions its own user and tenant with unique emails, so the suite runs fully parallel with no shared-state flakiness.
4. **Contract testing** — a small schema helper asserts field presence and types on every API response, including the uniform `{ error: { code, message } }` failure contract, and that passwords never leak.
5. **Layered coverage** — the same business rules are checked at the cheapest effective layer: contracts at API level, user experience at E2E level, business acceptance in the [UAT checklist](docs/uat-checklist.md).
6. **Manual + automated together** — exploratory charters and [edge cases](docs/edge-cases.md) feed the automation backlog; each edge case is tagged automated 🤖 or manual 📝.

## 📁 Folder structure

```
qa-sdet-saas-platform-testing/
├── .github/workflows/
│   └── playwright.yml            # CI: install → browsers → test → upload report
├── data/
│   ├── test-users.json           # Seeded users (2 tenants, admin + member roles)
│   ├── tenants.json              # Seeded tenants
│   └── payment-cards.json        # Simulated test cards (success/declined/timeout)
├── docs/
│   ├── test-plan.md              # Scope, objectives, entry/exit criteria, environment
│   ├── test-cases.md             # Scripted manual test cases (ID, steps, expected, priority)
│   ├── uat-checklist.md          # Business acceptance checklist + sign-off
│   ├── edge-cases.md             # Negative/boundary scenarios
│   ├── bug-report-samples.md     # 6 professional defect report examples
│   └── risk-analysis.md          # Scored risk register mapped to test coverage
├── mock-server/
│   └── server.js                 # Self-contained mock SaaS app (system under test)
├── tests/
│   ├── e2e/                      # Browser E2E suites (Chromium)
│   ├── api/                      # API suites (Playwright request context)
│   └── helpers/                  # Reusable flows, test data factory, schema assertions
├── playwright.config.ts          # list + HTML reporters, auto-starts the mock server
├── package.json
└── README.md
```

## 🚀 Getting started

```bash
git clone REPOSITORY_URL
cd qa-sdet-saas-platform-testing
npm install
npx playwright install
```

## ▶️ Running the tests

**Watch the tests run in a real browser (headed mode):**

```bash
npx playwright test --headed
```

**Headless (default — same command CI runs):**

```bash
npx playwright test
```

**Live terminal output** is on by default (the `list` reporter is configured), showing each test's ID, feature and expected behaviour, e.g.:

```
✓  [e2e-chromium] › onboarding.spec.ts › User Onboarding › TC-ONB-001 | creates a new user with valid data and shows the onboarding success message
✓  [api] › tenant-api.spec.ts › API: Multi-Tenant Access Control › TC-API-TEN-002 | blocks cross-tenant reads (403)
```

You can also force it explicitly with `npx playwright test --reporter=list`.

**Useful filters:**

```bash
npm run test:e2e     # browser E2E suites only
npm run test:api     # API suites only
```

**Open the HTML report** (screenshots, traces and videos are captured on failure):

```bash
npx playwright show-report
```

> The mock SaaS server starts automatically via Playwright's `webServer` hook — no separate terminal needed. To explore the app manually, run `npm run mock-server` and open <http://127.0.0.1:3100> (seed logins are in [`data/test-users.json`](data/test-users.json)).

## 🔁 CI/CD with GitHub Actions

The pipeline in [`.github/workflows/playwright.yml`](.github/workflows/playwright.yml) runs on every push and pull request:

1. Checkout + Node 20 setup with npm caching
2. `npm ci` — clean dependency install
3. `npx playwright install --with-deps chromium` — browser install
4. `npx playwright test` — full E2E + API suite (2 retries in CI, `forbidOnly` guard)
5. Uploads the **Playwright HTML report** as a build artifact (30-day retention) and failure traces/screenshots (14 days)

Download the `playwright-report` artifact from any run to review results without re-running anything.

## 🖼️ Evidence

<!-- Replace these placeholders with real captures after your first runs -->
| Evidence | File |
| --- | --- |
| Terminal `list` reporter output | `docs/evidence/terminal-run.png` *(placeholder)* |
| Playwright HTML report overview | `docs/evidence/html-report.png` *(placeholder)* |
| Headed run — payment flow | `docs/evidence/headed-payment.gif` *(placeholder)* |
| GitHub Actions green pipeline | `docs/evidence/ci-pipeline.png` *(placeholder)* |

## 🧭 How this project maps to real QA/SDET responsibilities

| Responsibility | Where it's demonstrated |
| --- | --- |
| Manual test planning & execution | [Test plan](docs/test-plan.md), [test cases](docs/test-cases.md) with IDs, preconditions, steps, priorities |
| Test automation (UI) | Playwright + TypeScript E2E suites with reusable flow helpers and `data-testid` selectors |
| API testing | Request-context suites: status codes, bodies, JSON contracts, 401/403 authorization matrix |
| Payment systems QA | Simulated gateway scenarios: approved, declined, timeout, invalid input — asserting final subscription state and access gating |
| SaaS onboarding flows | Full signup validation matrix + post-onboarding redirect and first login |
| Multi-tenant access control | Tenant isolation and role-based tests at both UI and API layers |
| UAT | [Business-facing checklist](docs/uat-checklist.md) with sign-off section |
| Defect management | [Six realistic bug reports](docs/bug-report-samples.md) with severity/priority triage |
| Risk-based testing | [Scored risk register](docs/risk-analysis.md) mapped to concrete suites |
| CI/CD | GitHub Actions pipeline with report artifacts and failure traces |
| Mobile automation readiness | Playwright device descriptors make mobile-web coverage a one-line config addition; helpers are structured for reuse in a future mobile layer |

## 🔒 Data & credentials

All users, tenants and payment cards in this repository are **fake and simulated**. Card numbers follow the public Stripe test-card convention and never touch a payment provider. No real credentials, tokens or personal data exist anywhere in this project.

## 📄 License

MIT — free to explore, fork and adapt.
