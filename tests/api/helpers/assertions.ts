import { expect } from '@playwright/test';
import type { AccountService } from '../services/account.service';

/**
 * Reads a user profile and verifies a 2xx response and partial JSON match.
 * @param accounts - Account service used to read the profile.
 * @param id - User identifier.
 * @param expectedBody - Fields that must match the returned JSON object.
 * @param token - Optional bearer token.
 * @returns The parsed JSON response body.
 */
export async function verifyObjectCreated(
  accounts: AccountService,
  id: string,
  expectedBody: Record<string, unknown>,
  token?: string,
) {
  const response = await accounts.getById(id, token);
  await expect(response, 'Created object must be accessible by ID').toBeOK();
  const body = await response.json();
  expect(body).toMatchObject(expectedBody);
  return body;
}

/**
 * Reads a user profile and verifies the expected absence response.
 * @param accounts - Account service used to read the profile.
 * @param id - Identifier of the deleted resource.
 * @param options - Bearer token, expected status (default 404) and optional JSON fields to match.
 * @returns The API response; JSON is parsed only when expectedBody is supplied.
 */
export async function verifyObjectDeleted(
  accounts: AccountService,
  id: string,
  options: {
    token?: string;
    expectedStatus?: number;
    expectedBody?: Record<string, unknown>;
  } = {},
) {
  const response = await accounts.getById(id, options.token);
  expect(response.status(), 'Deleted object must not be accessible by ID').toBe(
    options.expectedStatus ?? 404,
  );
  if (options.expectedBody) {
    expect(await response.json()).toMatchObject(options.expectedBody);
  }
  return response;
}