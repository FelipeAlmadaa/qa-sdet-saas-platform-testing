import { expect } from '@playwright/test';

type FieldType = 'string' | 'number' | 'boolean' | 'array' | 'object';
export interface Schema {
  [field: string]: FieldType | Schema;
}

/**
 * Lightweight JSON contract assertion: verifies every field in the schema
 * exists on the payload with the expected type (recursing into nested
 * objects). Keeps contract checks explicit without extra dependencies.
 */
export function expectMatchesSchema(payload: unknown, schema: Schema, path = 'body'): void {
  expect(payload, `${path} should be an object`).toBeTruthy();
  expect(typeof payload, `${path} should be an object`).toBe('object');
  const obj = payload as Record<string, unknown>;

  for (const [field, expected] of Object.entries(schema)) {
    const fieldPath = `${path}.${field}`;
    expect(obj, `${fieldPath} should be present`).toHaveProperty(field);
    const value = obj[field];

    if (typeof expected === 'object') {
      expectMatchesSchema(value, expected, fieldPath);
    } else if (expected === 'array') {
      expect(Array.isArray(value), `${fieldPath} should be an array`).toBe(true);
    } else {
      expect(typeof value, `${fieldPath} should be a ${expected}`).toBe(expected);
    }
  }
}

/** Standard error contract returned by every API failure response. */
export const ERROR_SCHEMA: Schema = {
  error: {
    code: 'string',
    message: 'string',
  },
};

/** Public user contract (must never expose the password). */
export const USER_SCHEMA: Schema = {
  id: 'string',
  fullName: 'string',
  email: 'string',
  role: 'string',
  tenantId: 'string',
  createdAt: 'string',
};
