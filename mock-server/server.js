/**
 * Mock SaaS platform used as the System Under Test (SUT).
 *
 * It simulates a multi-tenant subscription product with:
 *  - user onboarding (sign-up creates a user + a new tenant)
 *  - session-based web authentication and token-based API authentication
 *  - a fake payment gateway (Stripe-style test card numbers, no real provider)
 *  - tenant isolation and role-based access control (admin vs member)
 *
 * All state is in memory and reset on every server start, which keeps
 * test runs deterministic. Nothing here is production code — it exists
 * so the Playwright suites have a realistic application to test.
 */
const path = require('path');
const crypto = require('crypto');
const express = require('express');

const seedUsers = require(path.join(__dirname, '..', 'data', 'test-users.json'));
const seedTenants = require(path.join(__dirname, '..', 'data', 'tenants.json'));
const cards = require(path.join(__dirname, '..', 'data', 'payment-cards.json'));

const PORT = process.env.PORT || 3100;

// ---------------------------------------------------------------------------
// In-memory state
// ---------------------------------------------------------------------------
const users = new Map(); // email -> user
const tenants = new Map(); // tenantId -> tenant
const sessions = new Map(); // token -> { userId, email }

for (const tenant of seedTenants) {
  tenants.set(tenant.id, { ...tenant });
}
for (const user of seedUsers) {
  users.set(user.email.toLowerCase(), { ...user, createdAt: new Date().toISOString() });
}

// ---------------------------------------------------------------------------
// Domain helpers
// ---------------------------------------------------------------------------
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STRONG_PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

const MESSAGES = {
  requiredFields: 'All fields are required.',
  invalidEmail: 'Please enter a valid email address.',
  weakPassword: 'Password must be at least 8 characters and include an uppercase letter and a number.',
  duplicateEmail: 'An account with this email already exists.',
  invalidCredentials: 'Invalid email or password.',
  cardDeclined: 'Your card was declined. Please use a different payment method.',
  paymentTimeout: 'Payment processing timed out. Please try again.',
  invalidCard: 'Invalid card details. Please check the card number, expiry and CVC.',
  tenantForbidden: 'Access denied: you do not have permission to access this tenant.',
  roleForbidden: 'Access denied: only tenant admins can manage users.',
  unauthorized: 'Authentication required.',
};

function newId(prefix) {
  return `${prefix}-${crypto.randomBytes(6).toString('hex')}`;
}

function slugify(text) {
  return String(text).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function publicUser(user) {
  const { password, ...safe } = user;
  return safe;
}

function validateSignup({ fullName, email, password, companyName }) {
  if (!fullName || !email || !password || !companyName) return MESSAGES.requiredFields;
  if (!EMAIL_REGEX.test(email)) return MESSAGES.invalidEmail;
  if (!STRONG_PASSWORD_REGEX.test(password)) return MESSAGES.weakPassword;
  if (users.has(email.toLowerCase())) return MESSAGES.duplicateEmail;
  return null;
}

function createAccount({ fullName, email, password, companyName }) {
  const tenantId = `${slugify(companyName)}-${crypto.randomBytes(3).toString('hex')}`;
  tenants.set(tenantId, {
    id: tenantId,
    name: companyName,
    plan: 'free',
    subscriptionStatus: 'trial',
  });
  const user = {
    id: newId('u'),
    fullName,
    email: email.toLowerCase(),
    password,
    role: 'admin', // account creator administers the new tenant
    tenantId,
    createdAt: new Date().toISOString(),
  };
  users.set(user.email, user);
  return user;
}

/** Fake payment gateway. Outcome is decided purely by the test card number. */
function chargeCard(cardNumber, expiry, cvc) {
  const digits = String(cardNumber || '').replace(/\s+/g, '');
  if (!/^\d{16}$/.test(digits) || !expiry || !cvc) {
    return { ok: false, code: 'invalid_card', httpStatus: 400, message: MESSAGES.invalidCard };
  }
  if (digits === cards.declined.number) {
    return { ok: false, code: 'card_declined', httpStatus: 402, message: MESSAGES.cardDeclined };
  }
  if (digits === cards.timeout.number) {
    return { ok: false, code: 'gateway_timeout', httpStatus: 504, message: MESSAGES.paymentTimeout };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Auth helpers (web session cookie + API bearer token share the session store)
// ---------------------------------------------------------------------------
function createSession(user) {
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, { userId: user.id, email: user.email });
  return token;
}

function userFromToken(token) {
  const session = token && sessions.get(token);
  return session ? users.get(session.email) : null;
}

function cookieToken(req) {
  const match = (req.headers.cookie || '').match(/(?:^|;\s*)sid=([^;]+)/);
  return match ? match[1] : null;
}

function bearerToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

// ---------------------------------------------------------------------------
// HTML rendering (kept deliberately simple; selectors use data-testid)
// ---------------------------------------------------------------------------
function layout(title, body, user) {
  const nav = user
    ? `<nav>
         <a href="/dashboard" data-testid="nav-dashboard">Dashboard</a>
         <a href="/billing" data-testid="nav-billing">Billing</a>
         <a href="/reports" data-testid="nav-reports">Reports</a>
         <a href="/team" data-testid="nav-team">Team</a>
         <form method="POST" action="/logout" style="display:inline">
           <button type="submit" data-testid="logout-button">Log out</button>
         </form>
       </nav>`
    : `<nav>
         <a href="/login" data-testid="nav-login">Log in</a>
         <a href="/signup" data-testid="nav-signup">Sign up</a>
       </nav>`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title} · NimbusDesk</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; color: #1f2937; }
    nav { display: flex; gap: 1rem; align-items: center; margin-bottom: 2rem; border-bottom: 1px solid #e5e7eb; padding-bottom: .75rem; }
    label { display: block; margin-top: .75rem; font-weight: 600; }
    input, select { display: block; width: 100%; max-width: 360px; padding: .5rem; margin-top: .25rem; }
    button { margin-top: 1rem; padding: .5rem 1.25rem; cursor: pointer; }
    .error { background: #fef2f2; border: 1px solid #dc2626; color: #b91c1c; padding: .75rem; margin-top: 1rem; max-width: 480px; }
    .success { background: #f0fdf4; border: 1px solid #16a34a; color: #15803d; padding: .75rem; margin-top: 1rem; max-width: 480px; }
    .warning { background: #fffbeb; border: 1px solid #d97706; color: #b45309; padding: .75rem; margin-top: 1rem; max-width: 480px; }
    .badge { display: inline-block; padding: .15rem .6rem; border-radius: 999px; background: #eef2ff; border: 1px solid #6366f1; }
    table { border-collapse: collapse; margin-top: 1rem; } td, th { border: 1px solid #e5e7eb; padding: .4rem .8rem; text-align: left; }
  </style>
</head>
<body>
  <header><strong>NimbusDesk</strong> — mock SaaS platform (QA test target)</header>
  ${nav}
  <main>${body}</main>
</body>
</html>`;
}

function errorBox(message) {
  return message ? `<div class="error" data-testid="error-message" role="alert">${message}</div>` : '';
}

function signupPage(error = '', values = {}) {
  return layout('Sign up', `
    <h1>Create your account</h1>
    ${errorBox(error)}
    <form method="POST" action="/signup" novalidate>
      <label>Full name <input name="fullName" data-testid="signup-fullname" value="${values.fullName || ''}" /></label>
      <label>Work email <input name="email" type="text" data-testid="signup-email" value="${values.email || ''}" /></label>
      <label>Password <input name="password" type="password" data-testid="signup-password" /></label>
      <label>Company name <input name="companyName" data-testid="signup-company" value="${values.companyName || ''}" /></label>
      <button type="submit" data-testid="signup-submit">Create account</button>
    </form>
    <p>Already registered? <a href="/login">Log in</a></p>`);
}

function loginPage(error = '') {
  return layout('Log in', `
    <h1>Log in to NimbusDesk</h1>
    ${errorBox(error)}
    <form method="POST" action="/login" novalidate>
      <label>Email <input name="email" type="text" data-testid="login-email" /></label>
      <label>Password <input name="password" type="password" data-testid="login-password" /></label>
      <button type="submit" data-testid="login-submit">Log in</button>
    </form>
    <p>New here? <a href="/signup">Create an account</a></p>`);
}

function billingPage(user, tenant, { error = '', success = '' } = {}) {
  return layout('Billing', `
    <h1>Billing &amp; subscription</h1>
    <p>Current subscription:
      <span class="badge" data-testid="subscription-status">${tenant.subscriptionStatus}</span>
      (plan: <span data-testid="subscription-plan">${tenant.plan}</span>)
    </p>
    ${success ? `<div class="success" data-testid="payment-success">${success}</div>` : ''}
    ${error ? `<div class="error" data-testid="payment-error" role="alert">${error}</div>` : ''}
    <form method="POST" action="/billing" novalidate>
      <label>Plan
        <select name="plan" data-testid="billing-plan">
          <option value="pro">Pro — $29/month</option>
          <option value="business">Business — $79/month</option>
        </select>
      </label>
      <label>Card number <input name="cardNumber" data-testid="billing-card-number" autocomplete="off" /></label>
      <label>Expiry (MM/YY) <input name="expiry" data-testid="billing-expiry" /></label>
      <label>CVC <input name="cvc" data-testid="billing-cvc" /></label>
      <button type="submit" data-testid="billing-submit">Subscribe</button>
    </form>`, user);
}

// ---------------------------------------------------------------------------
// App + middleware
// ---------------------------------------------------------------------------
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

/** Web routes: redirect to /login when there is no valid session cookie. */
function requireWebSession(req, res, next) {
  const user = userFromToken(cookieToken(req));
  if (!user) return res.redirect('/login');
  req.user = user;
  req.tenant = tenants.get(user.tenantId);
  next();
}

/** API routes: 401 JSON error when the bearer token is missing or invalid. */
function requireApiToken(req, res, next) {
  const user = userFromToken(bearerToken(req));
  if (!user) {
    return res.status(401).json({ error: { code: 'unauthorized', message: MESSAGES.unauthorized } });
  }
  req.user = user;
  req.tenant = tenants.get(user.tenantId);
  next();
}

// ---------------------------------------------------------------------------
// Web UI routes
// ---------------------------------------------------------------------------
app.get('/', (req, res) => res.redirect('/login'));

app.get('/signup', (req, res) => res.send(signupPage()));

app.post('/signup', (req, res) => {
  const error = validateSignup(req.body);
  if (error) return res.status(400).send(signupPage(error, req.body));
  createAccount(req.body);
  res.redirect('/welcome');
});

app.get('/welcome', (req, res) => {
  res.send(layout('Welcome', `
    <h1 data-testid="welcome-heading">Welcome aboard!</h1>
    <div class="success" data-testid="onboarding-success">
      Your account and workspace were created successfully.
    </div>
    <p><a href="/login" data-testid="welcome-login-link">Log in to get started</a></p>`));
});

app.get('/login', (req, res) => res.send(loginPage()));

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = users.get(String(email || '').toLowerCase());
  if (!user || user.password !== password) {
    return res.status(401).send(loginPage(MESSAGES.invalidCredentials));
  }
  const token = createSession(user);
  res.setHeader('Set-Cookie', `sid=${token}; Path=/; HttpOnly`);
  res.redirect('/dashboard');
});

app.post('/logout', (req, res) => {
  sessions.delete(cookieToken(req));
  res.setHeader('Set-Cookie', 'sid=; Path=/; Max-Age=0');
  res.redirect('/login');
});

app.get('/dashboard', requireWebSession, (req, res) => {
  const pastDueBanner = req.tenant.subscriptionStatus === 'past_due'
    ? `<div class="warning" data-testid="limited-access-banner">
         Your last payment failed. Access is limited until billing is resolved.
         <a href="/billing">Update payment method</a>
       </div>`
    : '';
  res.send(layout('Dashboard', `
    <h1>Dashboard</h1>
    ${pastDueBanner}
    <p>Signed in as <strong data-testid="current-user">${req.user.fullName}</strong>
       (<span data-testid="current-role">${req.user.role}</span>)</p>
    <p>Workspace: <strong data-testid="current-tenant">${req.tenant.name}</strong></p>
    <p>Subscription:
      <span class="badge" data-testid="subscription-status">${req.tenant.subscriptionStatus}</span>
      (plan: <span data-testid="subscription-plan">${req.tenant.plan}</span>)
    </p>`, req.user));
});

app.get('/billing', requireWebSession, (req, res) => {
  const success = req.query.paid === '1'
    ? 'Payment successful. Your subscription is now active.'
    : '';
  res.send(billingPage(req.user, req.tenant, { success }));
});

app.post('/billing', requireWebSession, (req, res) => {
  const { cardNumber, expiry, cvc, plan } = req.body;
  const result = chargeCard(cardNumber, expiry, cvc);
  if (!result.ok) {
    if (result.code === 'card_declined') req.tenant.subscriptionStatus = 'past_due';
    return res.status(result.httpStatus).send(billingPage(req.user, req.tenant, { error: result.message }));
  }
  req.tenant.subscriptionStatus = 'active';
  req.tenant.plan = plan || 'pro';
  res.redirect('/billing?paid=1');
});

app.get('/reports', requireWebSession, (req, res) => {
  if (req.tenant.subscriptionStatus !== 'active') {
    return res.status(402).send(layout('Reports', `
      <h1>Reports</h1>
      <div class="warning" data-testid="access-blocked">
        Your subscription is not active. Upgrade on the <a href="/billing">billing page</a> to access reports.
      </div>`, req.user));
  }
  res.send(layout('Reports', `
    <h1>Reports</h1>
    <div data-testid="premium-content">
      <p>Monthly usage report for <strong>${req.tenant.name}</strong>.</p>
    </div>`, req.user));
});

app.get('/team', requireWebSession, (req, res) => {
  const requestedTenantId = req.query.tenant || req.user.tenantId;
  if (requestedTenantId !== req.user.tenantId) {
    return res.status(403).send(layout('Forbidden', `
      <h1>403 — Forbidden</h1>
      <div class="error" data-testid="forbidden-message">${MESSAGES.tenantForbidden}</div>`, req.user));
  }
  const members = [...users.values()].filter((u) => u.tenantId === req.user.tenantId);
  const rows = members
    .map((m) => `<tr data-testid="team-member"><td>${m.fullName}</td><td>${m.email}</td><td>${m.role}</td></tr>`)
    .join('');
  const inviteSection = req.user.role === 'admin'
    ? `<h2>Invite a teammate</h2>
       <form method="POST" action="/team/invite" data-testid="invite-form" novalidate>
         <label>Full name <input name="fullName" data-testid="invite-fullname" /></label>
         <label>Email <input name="email" data-testid="invite-email" /></label>
         <button type="submit" data-testid="invite-submit">Send invite</button>
       </form>`
    : `<p data-testid="member-notice">Contact your workspace admin to invite or manage users.</p>`;
  res.send(layout('Team', `
    <h1>Team — ${req.tenant.name}</h1>
    <table data-testid="team-table">
      <tr><th>Name</th><th>Email</th><th>Role</th></tr>
      ${rows}
    </table>
    ${inviteSection}`, req.user));
});

app.post('/team/invite', requireWebSession, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).send(layout('Forbidden', `
      <h1>403 — Forbidden</h1>
      <div class="error" data-testid="forbidden-message">${MESSAGES.roleForbidden}</div>`, req.user));
  }
  const { fullName, email } = req.body;
  if (fullName && email && EMAIL_REGEX.test(email) && !users.has(email.toLowerCase())) {
    users.set(email.toLowerCase(), {
      id: newId('u'),
      fullName,
      email: email.toLowerCase(),
      password: `Temp@${crypto.randomBytes(4).toString('hex')}`,
      role: 'member',
      tenantId: req.user.tenantId,
      createdAt: new Date().toISOString(),
    });
  }
  res.redirect('/team');
});

// ---------------------------------------------------------------------------
// JSON API routes
// ---------------------------------------------------------------------------
app.post('/api/users', (req, res) => {
  const error = validateSignup(req.body || {});
  if (error) {
    const code = error === MESSAGES.duplicateEmail ? 409 : 400;
    return res.status(code).json({ error: { code: code === 409 ? 'duplicate_email' : 'validation_error', message: error } });
  }
  const user = createAccount(req.body);
  res.status(201).json({ user: publicUser(user) });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = users.get(String(email || '').toLowerCase());
  if (!user || user.password !== password) {
    return res.status(401).json({ error: { code: 'invalid_credentials', message: MESSAGES.invalidCredentials } });
  }
  res.status(200).json({ token: createSession(user), user: publicUser(user) });
});

app.post('/api/auth/logout', requireApiToken, (req, res) => {
  sessions.delete(bearerToken(req));
  res.status(204).end();
});

app.get('/api/subscriptions/me', requireApiToken, (req, res) => {
  res.status(200).json({
    tenantId: req.tenant.id,
    plan: req.tenant.plan,
    status: req.tenant.subscriptionStatus,
  });
});

app.post('/api/subscriptions/checkout', requireApiToken, (req, res) => {
  const { plan, card } = req.body || {};
  const result = chargeCard(card && card.number, card && card.expiry, card && card.cvc);
  if (!result.ok) {
    if (result.code === 'card_declined') req.tenant.subscriptionStatus = 'past_due';
    return res.status(result.httpStatus).json({ error: { code: result.code, message: result.message } });
  }
  req.tenant.subscriptionStatus = 'active';
  req.tenant.plan = plan || 'pro';
  res.status(201).json({
    subscription: { tenantId: req.tenant.id, plan: req.tenant.plan, status: 'active' },
  });
});

app.get('/api/tenants/:tenantId/users', requireApiToken, (req, res) => {
  if (req.params.tenantId !== req.user.tenantId) {
    return res.status(403).json({ error: { code: 'tenant_forbidden', message: MESSAGES.tenantForbidden } });
  }
  const members = [...users.values()]
    .filter((u) => u.tenantId === req.user.tenantId)
    .map(publicUser);
  res.status(200).json({ tenantId: req.user.tenantId, users: members });
});

app.post('/api/tenants/:tenantId/users', requireApiToken, (req, res) => {
  if (req.params.tenantId !== req.user.tenantId) {
    return res.status(403).json({ error: { code: 'tenant_forbidden', message: MESSAGES.tenantForbidden } });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: { code: 'forbidden_role', message: MESSAGES.roleForbidden } });
  }
  const { fullName, email } = req.body || {};
  if (!fullName || !email || !EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: { code: 'validation_error', message: MESSAGES.requiredFields } });
  }
  if (users.has(email.toLowerCase())) {
    return res.status(409).json({ error: { code: 'duplicate_email', message: MESSAGES.duplicateEmail } });
  }
  const user = {
    id: newId('u'),
    fullName,
    email: email.toLowerCase(),
    password: `Temp@${crypto.randomBytes(4).toString('hex')}`,
    role: 'member',
    tenantId: req.user.tenantId,
    createdAt: new Date().toISOString(),
  };
  users.set(user.email, user);
  res.status(201).json({ user: publicUser(user) });
});

app.listen(PORT, () => {
  console.log(`NimbusDesk mock SaaS running at http://127.0.0.1:${PORT}`);
});
