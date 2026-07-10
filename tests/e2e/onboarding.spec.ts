import { test, expect } from '@playwright/test';
import { signUp } from '../helpers/app-actions';
import { newSignupData } from '../helpers/test-data';

/**
 * Feature: User onboarding (sign-up)
 * Covers account creation, field validation and the post-signup redirect.
 */
test.describe('User Onboarding', () => {
  test('TC-ONB-001 | creates a new user with valid data and shows the onboarding success message', async ({ page }) => {
    // Expected: valid signup data creates the account and confirms success
    await signUp(page, newSignupData());

    await expect(page.getByTestId('onboarding-success')).toContainText(
      'Your account and workspace were created successfully.',
    );
  });

  test('TC-ONB-002 | rejects submission when required fields are missing', async ({ page }) => {
    // Expected: empty form is rejected with a required-fields validation message
    await page.goto('/signup');
    await page.getByTestId('signup-submit').click();

    await expect(page.getByTestId('error-message')).toHaveText('All fields are required.');
    await expect(page).toHaveURL(/\/signup$/);
  });

  test('TC-ONB-003 | rejects an invalid email format', async ({ page }) => {
    // Expected: malformed email is rejected with a clear validation message
    await signUp(page, newSignupData({ email: 'not-an-email' }));

    await expect(page.getByTestId('error-message')).toHaveText(
      'Please enter a valid email address.',
    );
  });

  test('TC-ONB-004 | rejects a weak password with a helpful message', async ({ page }) => {
    // Expected: password below the policy triggers the weak-password message
    await signUp(page, newSignupData({ password: 'abc123' }));

    await expect(page.getByTestId('error-message')).toHaveText(
      'Password must be at least 8 characters and include an uppercase letter and a number.',
    );
  });

  test('TC-ONB-005 | redirects to the welcome page after successful onboarding and allows login', async ({ page }) => {
    // Expected: successful signup redirects to /welcome and the new account can log in
    const data = newSignupData();
    await signUp(page, data);

    await expect(page).toHaveURL(/\/welcome$/);
    await expect(page.getByTestId('welcome-heading')).toHaveText('Welcome aboard!');

    await page.getByTestId('welcome-login-link').click();
    await page.getByTestId('login-email').fill(data.email);
    await page.getByTestId('login-password').fill(data.password);
    await page.getByTestId('login-submit').click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByTestId('current-user')).toHaveText(data.fullName);
  });

  test('TC-ONB-006 | rejects a duplicate email registration', async ({ page }) => {
    // Expected: registering the same email twice fails with a duplicate-account message
    const data = newSignupData();
    await signUp(page, data);
    await expect(page).toHaveURL(/\/welcome$/);

    await signUp(page, data);
    await expect(page.getByTestId('error-message')).toHaveText(
      'An account with this email already exists.',
    );
  });
});
