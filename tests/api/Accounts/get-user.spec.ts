import type { APIResponse } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { test, expect } from '../fixtures/api.fixture';
import { userData } from '../data/users.data';
import { userProfileSchema } from '../helpers/schemas';
import { endpoints } from '../data/endpoints';

test.describe(`GET ${endpoints.account.user}/{UUID}`, { tag: '@regression' }, () => {
  let response: APIResponse;

  test('returns 200 with the user profile for a valid token', { tag: '@smoke' }, async ({ accounts, authenticatedUser: user }) => {
    await test.step('Read the user profile with a valid token', async () => {
      response = await accounts.getById(user.userID, user.token);
    });
    await test.step('Verify the JSON profile contract and persisted user fields', async () => {
      expect(response.status()).toBe(userData.httpStatus.ok);
      expect(response.headers()['content-type']).toMatch(/^application\/json(?:\s*;|$)/i);
      const body = userProfileSchema.parse(await response.json());
      expect(body).toMatchObject({
        userId: user.userID,
        username: user.credentials.userName,
        books: userData.responses.emptyBooks,
      });
    });
  });

  test('returns 401 for a request without authorization', async ({ accounts, authenticatedUser: user }) => {
    await test.step('Attempt to read the profile without authorization', async () => {
      response = await accounts.getById(user.userID);
    });
    await test.step('Verify access without a token is rejected with 401', async () => {
      expect(response.status()).toBe(userData.httpStatus.unauthorized);
    });
  });

  test('returns 401 for an invalid token', async ({ accounts, authenticatedUser: user }) => {
    await test.step('Attempt to read the profile with an invalid token', async () => {
      response = await accounts.getById(user.userID, userData.invalidToken);
    });
    await test.step('Verify the invalid token is rejected with 401', async () => {
      expect(response.status()).toBe(userData.httpStatus.unauthorized);
    });
  });

  test('returns 401 for a nonexistent user with a valid token', async ({ accounts, authenticatedUser: user }) => {
    await test.step('Attempt to read a nonexistent user with a valid token', async () => {
      response = await accounts.getById(randomUUID(), user.token);
    });
    await test.step('Verify the nonexistent user returns the expected 401 error', async () => {
      expect(response.status()).toBe(userData.httpStatus.unauthorized);
      expect(await response.json()).toMatchObject(userData.responses.userNotFound);
    });
  });
});