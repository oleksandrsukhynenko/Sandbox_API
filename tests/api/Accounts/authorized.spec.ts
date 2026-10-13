import { test, expect } from '@playwright/test';
import { createUser, login, cleanupUser, type User } from '../helpers/user.helper';
import { userData } from '../data/users.data';

test.describe('POST /Account/v1/Authorized', () => {
  let user: User;

  test.beforeEach(async ({ request }) => {
    user = await createUser(request);
  });

  test.afterEach(async ({ request }) => {
    if (user) {
      await cleanupUser(request, user);
    }
  });

  test('returns 200 with true after a token has been generated', async ({ request }) => {
    await login(request, user);

    const response = await request.post('/Account/v1/Authorized', {
      data: user.credentials,
    });
    expect(response.status()).toBe(userData.httpStatus.ok);
    expect(response.headers()['content-type']).toMatch(/^application\/json(?:\s*;|$)/i);
    const body = await response.json();
    expect(body).toBe(userData.responses.authorized);
    expect(body === true).toBe(true);
  });

  test('returns 200 with false before a token has been generated', async ({ request }) => {
    const response = await request.post('/Account/v1/Authorized', {
      data: user.credentials,
    });
    expect(response.status()).toBe(userData.httpStatus.ok);
    expect(await response.json()).toBe(userData.responses.notAuthorized);
  });

  for (const { name, credentials } of userData.missingCredentialsCases) {
    test(`returns 400 for ${name}`, async ({ request }) => {
      const response = await request.post('/Account/v1/Authorized', { data: credentials });
      expect(response.status()).toBe(userData.httpStatus.badRequest);
      expect(await response.json()).toMatchObject(userData.responses.invalidCredentials);
    });
  }

  test('returns 404 for an incorrect password', async ({ request }) => {
    const response = await request.post('/Account/v1/Authorized', {
      data: { ...user.credentials, password: userData.invalidPassword },
    });
    expect(response.status()).toBe(userData.httpStatus.notFound);
    expect(await response.json()).toMatchObject(userData.responses.userNotFound);
  });
});