import type { APIResponse } from '@playwright/test';
import { test, expect } from '../fixtures/api.fixture';
import { login } from '../helpers/user.helper';
import { userData } from '../data/users.data';
import { endpoints } from '../data/endpoints';

test.describe(`POST ${endpoints.account.authorized}`, { tag: '@regression' }, () => {
  let response: APIResponse;

  test('returns 200 with true after a token has been generated', async ({ accounts, user }) => {
    await test.step('Generate a token for the registered user', () => login(accounts, user));
    await test.step('Check authorization after token generation', async () => {
      response = await accounts.authorized(user.credentials);
    });
    await test.step('Verify a successful JSON response with authorized=true', async () => {
      expect(response.status()).toBe(userData.httpStatus.ok);
      expect(response.headers()['content-type']).toMatch(/^application\/json(?:\s*;|$)/i);
      const body = await response.json();
      expect(body).toBe(userData.responses.authorized);
      expect(body === true).toBe(true);
    });
  });

  test('returns 200 with false before a token has been generated', async ({ accounts, user }) => {
    await test.step('Check authorization before generating a token', async () => {
      response = await accounts.authorized(user.credentials);
    });
    await test.step('Verify authorized=false for a user without a generated token', async () => {
      expect(response.status()).toBe(userData.httpStatus.ok);
      expect(await response.json()).toBe(userData.responses.notAuthorized);
    });
  });

  for (const { name, credentials } of userData.missingCredentialsCases) {
    test(`returns 400 for ${name}`, async ({ accounts, user: _user }) => {
      await test.step(`Check authorization with ${name}`, async () => {
        response = await accounts.authorized(credentials);
      });
      await test.step('Verify invalid credentials are rejected with 400', async () => {
        expect(response.status()).toBe(userData.httpStatus.badRequest);
        expect(await response.json()).toMatchObject(userData.responses.invalidCredentials);
      });
    });
  }

  test('returns 404 for an incorrect password', async ({ accounts, user }) => {
    await test.step('Check authorization with an incorrect password', async () => {
      response = await accounts.authorized({ ...user.credentials, password: userData.invalidPassword });
    });
    await test.step('Verify the incorrect password returns the expected 404 error', async () => {
      expect(response.status()).toBe(userData.httpStatus.notFound);
      expect(await response.json()).toMatchObject(userData.responses.userNotFound);
    });
  });
});