# Manual Test Cases — NimbusDesk

Conventions: **Priority** P1 = critical path, P2 = high, P3 = medium.
Seed accounts come from [`data/test-users.json`](../data/test-users.json); simulated cards from [`data/payment-cards.json`](../data/payment-cards.json).

---

## 1. Onboarding

### TC-ONB-001 — Create account with valid data
- **Preconditions:** Email not registered.
- **Steps:**
  1. Open `/signup`.
  2. Fill full name, a unique valid email, a strong password (≥8 chars, 1 uppercase, 1 number) and a company name.
  3. Click **Create account**.
- **Expected result:** User is redirected to `/welcome` with the message "Your account and workspace were created successfully."; the new account can log in.
- **Priority:** P1

### TC-ONB-002 — Required field validation
- **Preconditions:** None.
- **Steps:**
  1. Open `/signup`.
  2. Submit the form with all fields empty.
- **Expected result:** Error "All fields are required."; user stays on `/signup`; no account is created.
- **Priority:** P1

### TC-ONB-003 — Invalid email format
- **Preconditions:** None.
- **Steps:**
  1. Open `/signup` and fill all fields, using `not-an-email` as the email.
  2. Submit.
- **Expected result:** Error "Please enter a valid email address."; no account created.
- **Priority:** P2

### TC-ONB-004 — Weak password rejected
- **Preconditions:** None.
- **Steps:**
  1. Open `/signup` and fill all fields, using `abc123` as the password.
  2. Submit.
- **Expected result:** Error "Password must be at least 8 characters and include an uppercase letter and a number."
- **Priority:** P1

### TC-ONB-005 — Duplicate email rejected
- **Preconditions:** An account already exists for the email.
- **Steps:**
  1. Register a new account successfully.
  2. Repeat the signup with the same email.
- **Expected result:** Error "An account with this email already exists."; the original account is unaffected.
- **Priority:** P2

---

## 2. Login

### TC-AUTH-001 — Login with valid credentials
- **Preconditions:** Seed user `alice.admin@acme-test.io` exists.
- **Steps:**
  1. Open `/login`, enter valid email + password, submit.
- **Expected result:** Redirect to `/dashboard`; the user's name, role and workspace are displayed.
- **Priority:** P1

### TC-AUTH-002 — Login with wrong password
- **Preconditions:** Seed user exists.
- **Steps:**
  1. Open `/login`, enter a valid email with a wrong password, submit.
- **Expected result:** Error "Invalid email or password."; user remains logged out.
- **Priority:** P1

### TC-AUTH-003 — Login with unregistered email
- **Preconditions:** Email is not registered.
- **Steps:**
  1. Open `/login`, enter an unknown email and any password, submit.
- **Expected result:** Same generic error as TC-AUTH-002 (no account enumeration).
- **Priority:** P2

### TC-AUTH-004 — Logout invalidates the session
- **Preconditions:** User is logged in.
- **Steps:**
  1. Click **Log out**.
  2. Navigate directly to `/dashboard`.
- **Expected result:** After logout the user lands on `/login`; direct navigation to `/dashboard` redirects back to `/login`.
- **Priority:** P1

### TC-AUTH-005 — Protected routes require authentication
- **Preconditions:** No active session.
- **Steps:**
  1. Open `/dashboard`, `/billing`, `/reports`, `/team` directly.
- **Expected result:** Every page redirects to `/login`.
- **Priority:** P1

---

## 3. Payment

### TC-PAY-001 — Successful payment
- **Preconditions:** Logged in; tenant on trial. Use simulated success card `4242 4242 4242 4242`.
- **Steps:**
  1. Open `/billing`, select the Pro plan, enter the success card, submit.
- **Expected result:** Message "Payment successful. Your subscription is now active."; status badge shows `active`.
- **Priority:** P1

### TC-PAY-002 — Declined card
- **Preconditions:** Logged in; tenant on trial. Use declined card `4000 0000 0000 0002`.
- **Steps:**
  1. Open `/billing`, enter the declined card, submit.
- **Expected result:** Error "Your card was declined. Please use a different payment method."; subscription is **not** activated; status becomes `past_due`.
- **Priority:** P1

### TC-PAY-003 — Payment gateway timeout
- **Preconditions:** Logged in; tenant on trial. Use timeout card `4000 0000 0000 0119`.
- **Steps:**
  1. Open `/billing`, enter the timeout card, submit.
- **Expected result:** Error "Payment processing timed out. Please try again."; subscription status unchanged (`trial`), so a retry is safe.
- **Priority:** P1

### TC-PAY-004 — Invalid card details
- **Preconditions:** Logged in.
- **Steps:**
  1. Open `/billing`, enter card number `1234`, submit.
- **Expected result:** Error "Invalid card details…"; no charge attempted.
- **Priority:** P2

---

## 4. Subscription

### TC-SUB-001 — Status reflected on dashboard after payment
- **Preconditions:** Fresh account (trial).
- **Steps:**
  1. Verify the dashboard badge shows `trial`.
  2. Complete a successful payment (TC-PAY-001).
  3. Return to `/dashboard`.
- **Expected result:** Badge shows `active` with plan `pro`.
- **Priority:** P1

### TC-SUB-002 — Access limited after failed payment
- **Preconditions:** Fresh account; declined payment executed (TC-PAY-002).
- **Steps:**
  1. Open `/dashboard`.
  2. Open `/reports`.
- **Expected result:** Dashboard shows the limited-access warning banner; `/reports` shows "Your subscription is not active." and no premium content.
- **Priority:** P1

### TC-SUB-003 — Premium content unlocked by an active subscription
- **Preconditions:** Fresh account.
- **Steps:**
  1. Open `/reports` while on trial → blocked.
  2. Pay successfully, reopen `/reports`.
- **Expected result:** Blocked before payment; report content visible after.
- **Priority:** P2

---

## 5. Multi-tenant access

### TC-TEN-001 — Tenant A cannot access Tenant B data
- **Preconditions:** Logged in as `alice.admin@acme-test.io` (Acme).
- **Steps:**
  1. Navigate to `/team?tenant=globex`.
- **Expected result:** HTTP 403 with "Access denied: you do not have permission to access this tenant."; no Globex data rendered.
- **Priority:** P1

### TC-TEN-002 — Team list shows only own tenant
- **Preconditions:** Logged in as an Acme user.
- **Steps:**
  1. Open `/team`.
- **Expected result:** Only Acme users listed; no Globex user appears.
- **Priority:** P1

### TC-TEN-003 — Admin manages only their own tenant
- **Preconditions:** Logged in as `carol.admin@globex-test.io` (Globex admin).
- **Steps:**
  1. Open `/team` → invite form visible.
  2. Open `/team?tenant=acme`.
- **Expected result:** Managing own tenant works; cross-tenant page returns 403.
- **Priority:** P1

### TC-TEN-004 — Member cannot manage users
- **Preconditions:** Logged in as `bob.member@acme-test.io` (member role).
- **Steps:**
  1. Open `/team`.
- **Expected result:** Team list visible, but no invite form; a notice explains that only admins manage users.
- **Priority:** P2

---

## 6. API integration

### TC-API-001 — Create user endpoint contract
- **Preconditions:** Unique email available.
- **Steps:**
  1. `POST /api/users` with `{fullName, email, password, companyName}`.
- **Expected result:** `201`; body contains `user` with `id, fullName, email, role, tenantId, createdAt`; **no password field**.
- **Priority:** P1

### TC-API-002 — Login endpoint returns a token
- **Preconditions:** Seed user exists.
- **Steps:**
  1. `POST /api/auth/login` with valid credentials.
- **Expected result:** `200`; body has `token` (string) and the public `user` object.
- **Priority:** P1

### TC-API-003 — Subscription checkout outcomes
- **Preconditions:** Valid bearer token for a trial tenant.
- **Steps:**
  1. `POST /api/subscriptions/checkout` with each simulated card.
- **Expected result:** success → `201` + `status: active`; declined → `402` + `card_declined`; timeout → `504`; invalid → `400`.
- **Priority:** P1

### TC-API-004 — Tenant endpoint enforces 401/403
- **Preconditions:** Tokens for Acme admin, Acme member and Globex admin.
- **Steps:**
  1. Call `GET /api/tenants/acme/users` with: no token, a forged token, the Globex token, and the Acme member token on `POST`.
- **Expected result:** no/forged token → `401 unauthorized`; cross-tenant → `403 tenant_forbidden`; member managing users → `403 forbidden_role`. All errors follow `{ error: { code, message } }`.
- **Priority:** P1
