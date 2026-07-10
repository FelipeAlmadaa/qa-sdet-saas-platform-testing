import { test, expect } from '@playwright/test';
import { logIn } from '../helpers/app-actions';
import { SEED } from '../helpers/test-data';

/**
 * Feature: Multi-tenant access control
 *
 * Uses the seeded tenants (Acme Corp and Globex Inc) in read-only fashion:
 *  - Alice: admin  @ Acme
 *  - Bob:   member @ Acme
 *  - Carol: admin  @ Globex
 */
test.describe('Multi-Tenant Access Control', () => {
  test('TC-TEN-001 | blocks a Tenant A user from viewing Tenant B data', async ({ page }) => {
    // Expected: an Acme user requesting the Globex team page gets a 403
    await logIn(page, SEED.acmeAdmin.email, SEED.acmeAdmin.password);

    const response = await page.goto('/team?tenant=globex');
    expect(response?.status()).toBe(403);
    await expect(page.getByTestId('forbidden-message')).toHaveText(
      'Access denied: you do not have permission to access this tenant.',
    );
  });

  test('TC-TEN-002 | shows a user only teammates from their own tenant', async ({ page }) => {
    // Expected: the Acme team list contains Acme users and never a Globex user
    await logIn(page, SEED.acmeAdmin.email, SEED.acmeAdmin.password);
    await page.goto('/team');

    const table = page.getByTestId('team-table');
    await expect(table).toContainText(SEED.acmeAdmin.email);
    await expect(table).toContainText(SEED.acmeMember.email);
    await expect(table).not.toContainText(SEED.globexAdmin.email);
  });

  test('TC-TEN-003 | lets an admin manage users only within their own tenant', async ({ page }) => {
    // Expected: the admin sees the invite form on their own team page,
    // but the same page for another tenant is forbidden
    await logIn(page, SEED.globexAdmin.email, SEED.globexAdmin.password);

    await page.goto('/team');
    await expect(page.getByTestId('invite-form')).toBeVisible();

    const response = await page.goto('/team?tenant=acme');
    expect(response?.status()).toBe(403);
  });

  test('TC-TEN-004 | hides user management from members (role-based access)', async ({ page }) => {
    // Expected: a member can view the team but gets no invite form
    await logIn(page, SEED.acmeMember.email, SEED.acmeMember.password);
    await page.goto('/team');

    await expect(page.getByTestId('invite-form')).toHaveCount(0);
    await expect(page.getByTestId('member-notice')).toContainText(
      'Contact your workspace admin',
    );
  });

  test('TC-TEN-005 | redirects unauthenticated access to tenant pages to login', async ({ page }) => {
    // Expected: anonymous visitors never reach tenant data
    await page.goto('/team?tenant=acme');
    await expect(page).toHaveURL(/\/login$/);
  });
});
