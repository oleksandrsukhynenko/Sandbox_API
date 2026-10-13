import { test, expect } from '@playwright/test';
import { createUser, login, cleanupUser, type User } from '../helpers/user.helper';
import { userData } from '../data/users.data';
import { failedTokenSchema, tokenSchema } from '../helpers/schemas';

test.describe('POST /Account/v1/GenerateToken', () => {
  let user: User;

  test.beforeEach(async ({ request }) => {
    user = await createUser(request);
  });

  test.afterEach(async ({ request }) => {
    if (user) {
      await cleanupUser(request, user);
    }
  });

  test('returns 200 with a token and a future expiration for valid credentials', async ({ request }) => {
    const body = tokenSchema.parse(await login(request, user));
    expect(Date.parse(body.expires)).toBeGreaterThan(Date.now());
  });

  test('returns 200 without a token for an incorrect password', async ({ request }) => {
    const response = await request.post('/Account/v1/GenerateToken', {
      data: { ...user.credentials, password: userData.invalidPassword },
    });
    expect(response.status()).toBe(userData.httpStatus.ok);
    const body = failedTokenSchema.parse(await response.json());
    expect(body).toMatchObject(userData.responses.loginFailure);
    const optionalBody: { token: string | null; metadata?: { expires?: string } } = body;
    expect(optionalBody.token?.toString()).toBeUndefined();
    expect(optionalBody.metadata?.expires).toBeUndefined();
  });

  for (const { name, credentials } of userData.missingCredentialsCases) {
    test(`returns 400 for ${name}`, async ({ request }) => {
      const response = await request.post('/Account/v1/GenerateToken', { data: credentials });
      expect(response.status()).toBe(userData.httpStatus.badRequest);
      expect(await response.json()).toMatchObject(userData.responses.invalidCredentials);
    });
  }
});