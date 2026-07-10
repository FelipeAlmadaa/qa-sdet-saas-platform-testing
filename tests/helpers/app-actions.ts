import { APIRequestContext, Page, expect } from '@playwright/test';
import { CARDS, SignupData, newSignupData } from './test-data';

/**
 * Reusable UI flows. Each helper drives the app exactly like a user would,
 * so the individual tests stay short and read like the scenario they cover.
 */

export async function signUp(page: Page, data: SignupData): Promise<void> {
  await page.goto('/signup');
  await page.getByTestId('signup-fullname').fill(data.fullName);
  await page.getByTestId('signup-email').fill(data.email);
  await page.getByTestId('signup-password').fill(data.password);
  await page.getByTestId('signup-company').fill(data.companyName);
  await page.getByTestId('signup-submit').click();
}

export async function logIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill(password);
  await page.getByTestId('login-submit').click();
}

/**
 * Creates a brand-new user (fresh tenant, `trial` subscription) and logs in.
 * Payment tests use this so each test owns its subscription state and can
 * run in parallel without interfering with other tests.
 */
export async function signUpAndLogIn(page: Page): Promise<SignupData> {
  const data = newSignupData();
  await signUp(page, data);
  await expect(page).toHaveURL(/\/welcome$/);
  await logIn(page, data.email, data.password);
  await expect(page).toHaveURL(/\/dashboard$/);
  return data;
}

export async function payWithCard(
  page: Page,
  card: { number: string; expiry: string; cvc: string },
): Promise<void> {
  await page.goto('/billing');
  await page.getByTestId('billing-card-number').fill(card.number);
  await page.getByTestId('billing-expiry').fill(card.expiry);
  await page.getByTestId('billing-cvc').fill(card.cvc);
  await page.getByTestId('billing-submit').click();
}

export { CARDS };

/**
 * Reusable API flows for the Playwright request context.
 */

export async function apiLogin(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<string> {
  const response = await request.post('/api/auth/login', { data: { email, password } });
  expect(response.status(), 'login should succeed for a valid seeded user').toBe(200);
  const body = await response.json();
  return body.token as string;
}

export function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

/** Registers a fresh user via the API and returns their credentials + token. */
export async function apiCreateUserAndLogin(
  request: APIRequestContext,
): Promise<{ data: SignupData; token: string; tenantId: string }> {
  const data = newSignupData();
  const created = await request.post('/api/users', { data });
  expect(created.status(), 'user creation should succeed').toBe(201);
  const { user } = await created.json();
  const token = await apiLogin(request, data.email, data.password);
  return { data, token, tenantId: user.tenantId as string };
}
