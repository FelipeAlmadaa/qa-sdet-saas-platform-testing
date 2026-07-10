import { test, expect } from '@playwright/test';
import { apiLogin, authHeaders } from '../helpers/app-actions';
import { SEED, uniqueEmail } from '../helpers/test-data';
import { expectMatchesSchema, ERROR_SCHEMA, USER_SCHEMA } from '../helpers/schema';

/**
 * Feature: Tenant access API — GET/POST /api/tenants/:tenantId/users
 * Covers tenant isolation, role-based authorization and the 401/403 contract.
 */
test.describe('API: Multi-Tenant Access Control', () => {
  test('TC-API-TEN-001 | lists only users belonging to the caller tenant (200)', async ({ request }) => {
    // Expected: the Acme list matches the contract and never contains Globex users
    const token = await apiLogin(request, SEED.acmeAdmin.email, SEED.acmeAdmin.password);

    const response = await request.get('/api/tenants/acme/users', { headers: authHeaders(token) });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expectMatchesSchema(body, { tenantId: 'string', users: 'array' });
    expectMatchesSchema(body.users[0], USER_SCHEMA);

    const emails = body.users.map((u: { email: string }) => u.email);
    expect(emails).toContain(SEED.acmeAdmin.email);
    expect(emails).not.toContain(SEED.globexAdmin.email);
    expect(body.users.every((u: { tenantId: string }) => u.tenantId === 'acme')).toBe(true);
  });

  test('TC-API-TEN-002 | blocks cross-tenant reads (403)', async ({ request }) => {
    // Expected: a Globex admin cannot list Acme users
    const token = await apiLogin(request, SEED.globexAdmin.email, SEED.globexAdmin.password);

    const response = await request.get('/api/tenants/acme/users', { headers: authHeaders(token) });
    expect(response.status()).toBe(403);
    const body = await response.json();
    expectMatchesSchema(body, ERROR_SCHEMA);
    expect(body.error.code).toBe('tenant_forbidden');
  });

  test('TC-API-TEN-003 | blocks an admin from managing users in another tenant (403)', async ({ request }) => {
    // Expected: admin rights do not cross the tenant boundary
    const token = await apiLogin(request, SEED.acmeAdmin.email, SEED.acmeAdmin.password);

    const response = await request.post('/api/tenants/globex/users', {
      headers: authHeaders(token),
      data: { fullName: 'Intruder Invite', email: uniqueEmail('intruder') },
    });
    expect(response.status()).toBe(403);
    expect((await response.json()).error.code).toBe('tenant_forbidden');
  });

  test('TC-API-TEN-004 | blocks members from managing users (403, role-based)', async ({ request }) => {
    // Expected: a member of the SAME tenant still cannot invite users
    const token = await apiLogin(request, SEED.acmeMember.email, SEED.acmeMember.password);

    const response = await request.post('/api/tenants/acme/users', {
      headers: authHeaders(token),
      data: { fullName: 'Member Invite', email: uniqueEmail('member-invite') },
    });
    expect(response.status()).toBe(403);
    expect((await response.json()).error.code).toBe('forbidden_role');
  });

  test('TC-API-TEN-005 | lets an admin invite a user into their own tenant (201)', async ({ request }) => {
    // Expected: happy path — the invited user lands in the admin's tenant as a member
    const token = await apiLogin(request, SEED.globexAdmin.email, SEED.globexAdmin.password);

    const response = await request.post('/api/tenants/globex/users', {
      headers: authHeaders(token),
      data: { fullName: 'Invited Member', email: uniqueEmail('globex-invite') },
    });
    expect(response.status()).toBe(201);
    const body = await response.json();
    expectMatchesSchema(body, { user: USER_SCHEMA });
    expect(body.user.tenantId).toBe('globex');
    expect(body.user.role).toBe('member');
  });

  test('TC-API-TEN-006 | rejects missing and invalid tokens on tenant endpoints (401)', async ({ request }) => {
    // Expected: both anonymous and forged-token calls return the 401 contract
    const anonymous = await request.get('/api/tenants/acme/users');
    expect(anonymous.status()).toBe(401);

    const forged = await request.get('/api/tenants/acme/users', {
      headers: authHeaders('invalid-api-token'),
    });
    expect(forged.status()).toBe(401);
    const body = await forged.json();
    expectMatchesSchema(body, ERROR_SCHEMA);
    expect(body.error.code).toBe('unauthorized');
  });
});
