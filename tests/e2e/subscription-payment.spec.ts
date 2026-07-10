import { test, expect } from '@playwright/test';
import { signUpAndLogIn, payWithCard } from '../helpers/app-actions';
import { CARDS } from '../helpers/test-data';

/**
 * Feature: Subscription and payment flow
 *
 * Every test creates its OWN user and tenant (fresh `trial` subscription),
 * so payment outcomes never leak between tests and the suite is safe to
 * run fully in parallel. All card numbers are simulated test cards.
 */
test.describe('Subscription & Payments', () => {
  test('TC-PAY-001 | activates the subscription after a successful payment', async ({ page }) => {
    // Expected: approved test card shows a success confirmation
    await signUpAndLogIn(page);
    await payWithCard(page, CARDS.success);

    await expect(page.getByTestId('payment-success')).toContainText(
      'Payment successful. Your subscription is now active.',
    );
    await expect(page.getByTestId('subscription-status')).toHaveText('active');
  });

  test('TC-PAY-002 | reflects the active subscription status on the dashboard', async ({ page }) => {
    // Expected: after payment, the dashboard badge switches from trial to active
    await signUpAndLogIn(page);
    await expect(page.getByTestId('subscription-status')).toHaveText('trial');

    await payWithCard(page, CARDS.success);
    await page.goto('/dashboard');

    await expect(page.getByTestId('subscription-status')).toHaveText('active');
    await expect(page.getByTestId('subscription-plan')).toHaveText('pro');
  });

  test('TC-PAY-003 | shows a clear error when the card is declined', async ({ page }) => {
    // Expected: declined test card surfaces the decline message, no activation
    await signUpAndLogIn(page);
    await payWithCard(page, CARDS.declined);

    await expect(page.getByTestId('payment-error')).toHaveText(
      'Your card was declined. Please use a different payment method.',
    );
    await expect(page.getByTestId('subscription-status')).not.toHaveText('active');
  });

  test('TC-PAY-004 | limits user access after a failed payment', async ({ page }) => {
    // Expected: after a decline the account is past_due — the dashboard warns
    // about limited access and premium reports are blocked
    await signUpAndLogIn(page);
    await payWithCard(page, CARDS.declined);

    await page.goto('/dashboard');
    await expect(page.getByTestId('limited-access-banner')).toContainText(
      'Your last payment failed. Access is limited',
    );

    await page.goto('/reports');
    await expect(page.getByTestId('access-blocked')).toContainText(
      'Your subscription is not active.',
    );
  });

  test('TC-PAY-005 | shows a retryable error when the payment gateway times out', async ({ page }) => {
    // Expected: gateway timeout keeps the subscription unchanged and asks to retry
    await signUpAndLogIn(page);
    await payWithCard(page, CARDS.timeout);

    await expect(page.getByTestId('payment-error')).toHaveText(
      'Payment processing timed out. Please try again.',
    );
    await expect(page.getByTestId('subscription-status')).toHaveText('trial');
  });

  test('TC-PAY-006 | rejects malformed card details before charging', async ({ page }) => {
    // Expected: an invalid card number fails input validation, not the gateway
    await signUpAndLogIn(page);
    await payWithCard(page, { ...CARDS.invalidFormat });

    await expect(page.getByTestId('payment-error')).toHaveText(
      'Invalid card details. Please check the card number, expiry and CVC.',
    );
  });

  test('TC-PAY-007 | grants access to premium content once the subscription is active', async ({ page }) => {
    // Expected: reports are blocked on trial and unlocked after payment
    await signUpAndLogIn(page);

    await page.goto('/reports');
    await expect(page.getByTestId('access-blocked')).toBeVisible();

    await payWithCard(page, CARDS.success);
    await page.goto('/reports');
    await expect(page.getByTestId('premium-content')).toBeVisible();
  });
});
