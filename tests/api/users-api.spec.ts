import { test, expect } from '@playwright/test';
import { newSignupData } from '../helpers/test-data';
import { expectMatchesSchema, ERROR_SCHEMA, USER_SCHEMA } from '../helpers/schema';

/**
 * Feature: User creation API — POST /api/users
 * Covers the success contract, validation failures and duplicate handling.
 */
test.describe('API: User Creation', () => {
  test('TC-API-USR-001 | creates a user and returns the public user contract (201)', async ({ request }) => {
    // Expected: 201 with the user object, matching the contract, no password leaked
    const payload = newSignupData();
    const response = await request.post('/api/users', { data: payload });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expectMatchesSchema(body, { user: USER_SCHEMA });
    expect(body.user.email).toBe(payload.email.toLowerCase());
    expect(body.user.role).toBe('admin');
    expect(body.user).not.toHaveProperty('password');
  });

  test('TC-API-USR-002 | rejects missing required fields (400)', async ({ request }) => {
    // Expected: 400 with the standard error contract
    const response = await request.post('/api/users', {
      data: { email: newSignupData().email },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expectMatchesSchema(body, ERROR_SCHEMA);
    expect(body.error.code).toBe('validation_error');
    expect(body.error.message).toBe('All fields are required.');
  });

  test('TC-API-USR-003 | rejects an invalid email format (400)', async ({ request }) => {
    // Expected: 400 validation error naming the email problem
    const response = await request.post('/api/users', {
      data: newSignupData({ email: 'invalid-email-format' }),
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error.message).toBe('Please enter a valid email address.');
  });

  test('TC-API-USR-004 | rejects a weak password (400)', async ({ request }) => {
    // Expected: 400 with the password-policy message
    const response = await request.post('/api/users', {
      data: newSignupData({ password: 'short1' }),
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error.message).toContain('Password must be at least 8 characters');
  });

  test('TC-API-USR-005 | rejects a duplicate email (409)', async ({ request }) => {
    // Expected: second registration with the same email conflicts
    const payload = newSignupData();
    const first = await request.post('/api/users', { data: payload });
    expect(first.status()).toBe(201);

    const second = await request.post('/api/users', { data: payload });
    expect(second.status()).toBe(409);
    const body = await second.json();
    expectMatchesSchema(body, ERROR_SCHEMA);
    expect(body.error.code).toBe('duplicate_email');
  });
});
