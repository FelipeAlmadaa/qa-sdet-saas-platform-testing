import { test, expect } from '@playwright/test';
import { logIn } from '../helpers/app-actions';
import { SEED } from '../helpers/test-data';

/**
 * Feature: Login and authentication
 * Covers valid/invalid login, error messaging, logout and session protection.
 */
test.describe('Login & Authentication', () => {
  test('TC-AUTH-001 | logs in with valid credentials and lands on the dashboard', async ({ page }) => {
    // Expected: seeded admin logs in and sees their name, role and tenant
    await logIn(page, SEED.acmeAdmin.email, SEED.acmeAdmin.password);

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByTestId('current-user')).toHaveText(SEED.acmeAdmin.fullName);
    await expect(page.getByTestId('current-tenant')).toHaveText('Acme Corp');
  });

  test('TC-AUTH-002 | rejects login with a wrong password', async ({ page }) => {
    // Expected: wrong password is rejected with a generic credentials error
    await logIn(page, SEED.acmeAdmin.email, 'WrongPassword1');

    await expect(page.getByTestId('error-message')).toHaveText('Invalid email or password.');
    await expect(page).not.toHaveURL(/\/dashboard/);
  });

  test('TC-AUTH-003 | rejects login for an unknown account with the same generic error', async ({ page }) => {
    // Expected: unknown email gets the same message as a wrong password
    // (no account-enumeration hint — a deliberate security behaviour)
    await logIn(page, 'ghost.user@nowhere-test.io', 'Whatever123');

    await expect(page.getByTestId('error-message')).toHaveText('Invalid email or password.');
  });

  test('TC-AUTH-004 | logs out and invalidates the session', async ({ page }) => {
    // Expected: after logout the user returns to /login and the dashboard
    // is no longer reachable with the old session
    await logIn(page, SEED.acmeMember.email, SEED.acmeMember.password);
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByTestId('logout-button').click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('TC-AUTH-005 | redirects unauthenticated visitors from protected pages to login', async ({ page }) => {
    // Expected: every protected page bounces an anonymous visitor to /login
    for (const protectedPath of ['/dashboard', '/billing', '/reports', '/team']) {
      await page.goto(protectedPath);
      await expect(page, `${protectedPath} should require authentication`).toHaveURL(/\/login$/);
    }
  });
});
