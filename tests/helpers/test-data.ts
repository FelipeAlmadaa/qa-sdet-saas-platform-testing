import seedUsers from '../../data/test-users.json';
import cards from '../../data/payment-cards.json';

/** Seeded users (loaded into the mock server on startup). Treat as read-only. */
export const SEED = {
  acmeAdmin: seedUsers[0],
  acmeMember: seedUsers[1],
  globexAdmin: seedUsers[2],
};

/** Simulated payment cards — Stripe test-card convention, never a real card. */
export const CARDS = cards;

export const STRONG_PASSWORD = 'Sup3rSecure!Pass';

/** Generates a unique email so parallel tests never collide on state. */
export function uniqueEmail(prefix = 'qa.user'): string {
  return `${prefix}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example-test.io`;
}

/** A complete, valid signup payload with a unique email per call. */
export function newSignupData(overrides: Partial<SignupData> = {}): SignupData {
  return {
    fullName: 'Quinn Tester',
    email: uniqueEmail(),
    password: STRONG_PASSWORD,
    companyName: 'QA Test Company',
    ...overrides,
  };
}

export interface SignupData {
  fullName: string;
  email: string;
  password: string;
  companyName: string;
}
