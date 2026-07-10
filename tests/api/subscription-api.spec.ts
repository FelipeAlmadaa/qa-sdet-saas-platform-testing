import { test, expect } from '@playwright/test';
import { apiCreateUserAndLogin, authHeaders } from '../helpers/app-actions';
import { CARDS } from '../helpers/test-data';
import { expectMatchesSchema, ERROR_SCHEMA } from '../helpers/schema';

/**
 * Feature: Subscription API — GET /api/subscriptions/me, POST /api/subscriptions/checkout
 *
 * Each test provisions its own user/tenant via the API, so subscription
 * state is isolated per test. Card numbers are simulated test cards only.
 */
test.describe('API: Subscriptions & Payments', () => {
  test('TC-API-SUB-001 | reports the trial status for a new tenant (200)', async ({ request }) => {
    // Expected: a freshly created tenant starts on the free/trial plan
    const { token } = await apiCreateUserAndLogin(request);

    const response = await request.get('/api/subscriptions/me', { headers: authHeaders(token) });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expectMatchesSchema(body, { tenantId: 'string', plan: 'string', status: 'string' });
    expect(body.status).toBe('trial');
  });

  test('TC-API-SUB-002 | activates the subscription on a successful charge (201)', async ({ request }) => {
    // Expected: 201 with the subscription contract, then /me reports active
    const { token } = await apiCreateUserAndLogin(request);

    const checkout = await request.post('/api/subscriptions/checkout', {
      headers: authHeaders(token),
      data: { plan: 'pro', card: CARDS.success },
    });
    expect(checkout.status()).toBe(201);
    const body = await checkout.json();
    expectMatchesSchema(body, {
      subscription: { tenantId: 'string', plan: 'string', status: 'string' },
    });
    expect(body.subscription.status).toBe('active');

    const me = await request.get('/api/subscriptions/me', { headers: authHeaders(token) });
    expect((await me.json()).status).toBe('active');
  });

  test('TC-API-SUB-003 | returns 402 and past_due when the card is declined', async ({ request }) => {
    // Expected: decline is a 402 payment-required error and the tenant is flagged
    const { token } = await apiCreateUserAndLogin(request);

    const checkout = await request.post('/api/subscriptions/checkout', {
      headers: authHeaders(token),
      data: { plan: 'pro', card: CARDS.declined },
    });
    expect(checkout.status()).toBe(402);
    const body = await checkout.json();
    expectMatchesSchema(body, ERROR_SCHEMA);
    expect(body.error.code).toBe('card_declined');

    const me = await request.get('/api/subscriptions/me', { headers: authHeaders(token) });
    expect((await me.json()).status).toBe('past_due');
  });

  test('TC-API-SUB-004 | returns 504 on a gateway timeout without changing the status', async ({ request }) => {
    // Expected: a timeout is retryable — subscription state must not change
    const { token } = await apiCreateUserAndLogin(request);

    const checkout = await request.post('/api/subscriptions/checkout', {
      headers: authHeaders(token),
      data: { plan: 'pro', card: CARDS.timeout },
    });
    expect(checkout.status()).toBe(504);
    expect((await checkout.json()).error.code).toBe('gateway_timeout');

    const me = await request.get('/api/subscriptions/me', { headers: authHeaders(token) });
    expect((await me.json()).status).toBe('trial');
  });

  test('TC-API-SUB-005 | rejects malformed card data (400)', async ({ request }) => {
    // Expected: input validation fails before any charge is attempted
    const { token } = await apiCreateUserAndLogin(request);

    const checkout = await request.post('/api/subscriptions/checkout', {
      headers: authHeaders(token),
      data: { plan: 'pro', card: CARDS.invalidFormat },
    });
    expect(checkout.status()).toBe(400);
    expect((await checkout.json()).error.code).toBe('invalid_card');
  });

  test('TC-API-SUB-006 | requires authentication for checkout (401)', async ({ request }) => {
    // Expected: anonymous checkout attempts are rejected
    const response = await request.post('/api/subscriptions/checkout', {
      data: { plan: 'pro', card: CARDS.success },
    });
    expect(response.status()).toBe(401);
    expectMatchesSchema(await response.json(), ERROR_SCHEMA);
  });
});
