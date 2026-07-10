import { test, expect } from '@playwright/test';
import { authHeaders, apiLogin } from '../helpers/app-actions';
import { SEED } from '../helpers/test-data';
import { expectMatchesSchema, ERROR_SCHEMA, USER_SCHEMA } from '../helpers/schema';

/**
 * Feature: Authentication API — POST /api/auth/login, POST /api/auth/logout
 * Covers the token contract, credential failures and session invalidation.
 */
test.describe('API: Authentication', () => {
  test('TC-API-AUTH-001 | login returns a token and the user contract (200)', async ({ request }) => {
    // Expected: 200 with a bearer token and the sanitized user object
    const response = await request.post('/api/auth/login', {
      data: { email: SEED.acmeAdmin.email, password: SEED.acmeAdmin.password },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expectMatchesSchema(body, { token: 'string', user: USER_SCHEMA });
    expect(body.token.length).toBeGreaterThanOrEqual(32);
    expect(body.user).not.toHaveProperty('password');
  });

  test('TC-API-AUTH-002 | login rejects a wrong password (401)', async ({ request }) => {
    // Expected: 401 with the standard error contract
    const response = await request.post('/api/auth/login', {
      data: { email: SEED.acmeAdmin.email, password: 'WrongPassword1' },
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expectMatchesSchema(body, ERROR_SCHEMA);
    expect(body.error.code).toBe('invalid_credentials');
  });

  test('TC-API-AUTH-003 | login rejects an unknown account with the same 401 (no enumeration)', async ({ request }) => {
    // Expected: unknown email is indistinguishable from a wrong password
    const response = await request.post('/api/auth/login', {
      data: { email: 'ghost.user@nowhere-test.io', password: 'Whatever123' },
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error.message).toBe('Invalid email or password.');
  });

  test('TC-API-AUTH-004 | logout invalidates the token (204, then 401)', async ({ request }) => {
    // Expected: logout succeeds and the token stops working immediately
    const token = await apiLogin(request, SEED.acmeMember.email, SEED.acmeMember.password);

    const logout = await request.post('/api/auth/logout', { headers: authHeaders(token) });
    expect(logout.status()).toBe(204);

    const afterLogout = await request.get('/api/subscriptions/me', { headers: authHeaders(token) });
    expect(afterLogout.status()).toBe(401);
  });

  test('TC-API-AUTH-005 | protected endpoints reject missing and invalid tokens (401)', async ({ request }) => {
    // Expected: no token and a forged token both return the 401 error contract
    const noToken = await request.get('/api/subscriptions/me');
    expect(noToken.status()).toBe(401);

    const forged = await request.get('/api/subscriptions/me', {
      headers: authHeaders('forged-token-000'),
    });
    expect(forged.status()).toBe(401);
    expectMatchesSchema(await forged.json(), ERROR_SCHEMA);
  });
});
