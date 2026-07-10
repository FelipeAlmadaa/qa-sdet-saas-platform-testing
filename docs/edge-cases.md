# Edge Cases — NimbusDesk

Negative and boundary scenarios that complement the happy-path suites. Status column: 🤖 automated / 📝 manual-only.

| # | Area | Edge case | Expected behaviour | Status |
| --- | --- | --- | --- | --- |
| EC-01 | Onboarding | Duplicate email registration | 409 / "An account with this email already exists."; original account untouched | 🤖 `onboarding.spec.ts`, `users-api.spec.ts` |
| EC-02 | Onboarding | All required fields missing | Single clear validation error; no partial account or orphan tenant created | 🤖 |
| EC-03 | Onboarding | Email with surrounding spaces or uppercase (`  User@Test.IO `) | Normalized (trimmed/lowercased) or rejected consistently in UI and API | 📝 |
| EC-04 | Auth | Expired/invalidated session (logout in another tab, server restart) | Redirect to `/login`; no stale private data rendered from cache | 🤖 partially (`auth.spec.ts` TC-AUTH-004) |
| EC-05 | Auth | Invalid or forged API token | `401` with `{error: {code: "unauthorized"}}`; response identical for missing vs forged token | 🤖 `auth-api.spec.ts`, `tenant-api.spec.ts` |
| EC-06 | Payments | Payment gateway timeout mid-charge | `504`; subscription state unchanged; retry safe (no double activation/charge) | 🤖 `subscription-payment.spec.ts`, `subscription-api.spec.ts` |
| EC-07 | Payments | Declined card | `402 card_declined`; status `past_due`; access limited but account not deleted | 🤖 |
| EC-08 | Payments | Card number with wrong length/characters | Rejected by input validation (`400`) before any gateway call | 🤖 |
| EC-09 | Payments | Double-submit of the payment form (double click) | Exactly one charge/activation; UI disables or dedupes the second submit | 📝 |
| EC-10 | Multi-tenant | User crafts a URL/API call for another company's data (`/team?tenant=globex`, `GET /api/tenants/acme/users`) | `403 tenant_forbidden`; zero data leakage in body, headers or timing | 🤖 `multi-tenant.spec.ts`, `tenant-api.spec.ts` |
| EC-11 | Multi-tenant | Admin tries to manage another tenant's users | `403 tenant_forbidden` — admin role does not cross the tenant boundary | 🤖 |
| EC-12 | Multi-tenant | Invalid/non-existent tenant ID in the URL or API path | `403` (not `404`) so attackers cannot enumerate which tenant IDs exist | 📝 |
| EC-13 | Multi-tenant | Member (non-admin) calls a management endpoint of their own tenant | `403 forbidden_role` with a distinct error code from the cross-tenant case | 🤖 |
| EC-14 | API | Missing `Content-Type` / malformed JSON body | `400` validation error, not a 500 stack trace | 📝 |
| EC-15 | API | Login response for unknown email vs wrong password | Identical `401` message and timing — no account enumeration | 🤖 `auth-api.spec.ts` |
| EC-16 | Security | Password present in any API response | Never — asserted on every user-returning endpoint | 🤖 |

## Notes for manual exploration
- Combine EC-04 + EC-10: log out in tab A while tab B is on `/team`, then act in tab B.
- Combine EC-07 + retry: after a decline, retry with the success card and confirm status transitions `past_due → active` cleanly.
