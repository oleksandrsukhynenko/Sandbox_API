import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { createUser, login, cleanupUser, type User } from '../helpers/user.helper';
import { userData } from '../data/users.data';
import { userProfileSchema } from '../helpers/schemas';

test.describe('GET /Account/v1/User/{UUID}', () => {
  let user: User;

  test.beforeEach(async ({ request }) => {
    user = await createUser(request);
    await login(request, user);
  });

  test.afterEach(async ({ request }) => {
    if (user) {
      await cleanupUser(request, user);
    }
  });

  test('returns 200 with the user profile for a valid token', async ({ request }) => {
    const response = await request.get(`/Account/v1/User/${user.userID}`, {
      headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(response.status()).toBe(userData.httpStatus.ok);
    expect(response.headers()['content-type']).toMatch(/^application\/json(?:\s*;|$)/i);
    const body = userProfileSchema.parse(await response.json());
    expect(body).toMatchObject({
      userId: user.userID,
      username: user.credentials.userName,
      books: userData.responses.emptyBooks,
    });
  });

  test('returns 401 for a request without authorization', async ({ request }) => {
    const response = await request.get(`/Account/v1/User/${user.userID}`);
    expect(response.status()).toBe(userData.httpStatus.unauthorized);
  });

  test('returns 401 for an invalid token', async ({ request }) => {
    const response = await request.get(`/Account/v1/User/${user.userID}`, {
      headers: { Authorization: `Bearer ${userData.invalidToken}` },
    });
    expect(response.status()).toBe(userData.httpStatus.unauthorized);
  });

  test('returns 401 for a nonexistent user with a valid token', async ({ request }) => {
    const response = await request.get(`/Account/v1/User/${randomUUID()}`, {
      headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(response.status()).toBe(userData.httpStatus.unauthorized);
    expect(await response.json()).toMatchObject(userData.responses.userNotFound);
  });
});