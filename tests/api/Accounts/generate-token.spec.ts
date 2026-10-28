import type { APIResponse } from '@playwright/test';
import { test, expect } from '../fixtures/api.fixture';
import { login } from '../helpers/user.helper';
import { userData } from '../data/users.data';
import { failedTokenSchema, tokenSchema } from '../helpers/schemas';
import { endpoints } from '../data/endpoints';

test.describe(`POST ${endpoints.account.generateToken}`, { tag: '@regression' }, () => {
  let response: APIResponse;

  test('returns 200 with a token and a future expiration for valid credentials', { tag: '@smoke' }, async ({ accounts, user }) => {
    const body = await test.step('Generate a token and validate its response schema', async () =>
      tokenSchema.parse(await login(accounts, user)));
    await test.step('Verify the generated token has a future expiration', async () => {
      expect(Date.parse(body.expires)).toBeGreaterThan(Date.now());
    });
  });

  test('returns 200 without a token for an incorrect password', async ({ accounts, user }) => {
    await test.step('Attempt token generation with an incorrect password', async () => {
      response = await accounts.generateToken({ ...user.credentials, password: userData.invalidPassword });
    });
    await test.step('Verify the failed-token contract and absence of a usable token', async () => {
      expect(response.status()).toBe(userData.httpStatus.ok);
      const body = failedTokenSchema.parse(await response.json());
      expect(body).toMatchObject(userData.responses.loginFailure);
      const optionalBody: { token: string | null; metadata?: { expires?: string } } = body;
      expect(optionalBody.token?.toString()).toBeUndefined();
      expect(optionalBody.metadata?.expires).toBeUndefined();
    });
  });

  for (const { name, credentials } of userData.missingCredentialsCases) {
    test(`returns 400 for ${name}`, async ({ accounts, user: _user }) => {
      await test.step(`Attempt token generation with ${name}`, async () => {
        response = await accounts.generateToken(credentials);
      });
      await test.step('Verify invalid credentials are rejected with 400', async () => {
        expect(response.status()).toBe(userData.httpStatus.badRequest);
        expect(await response.json()).toMatchObject(userData.responses.invalidCredentials);
      });
    });
  }
});