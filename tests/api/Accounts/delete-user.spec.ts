import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { createUser, login, deleteUser, cleanupUser, type User } from '../helpers/user.helper';
import { verifyObjectDeleted } from '../helpers/assertions';
import { userData } from '../data/users.data';

test.describe('DELETE /Account/v1/User/{UUID}', () => {
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

  test('returns 204 on deletion and prevents subsequent login', async ({ request }) => {
    const response = await deleteUser(request, user);
    expect(await response.text()).toBe(userData.responses.emptyBody);

    await verifyObjectDeleted(request, '/Account/v1/User', user.userID, {
      headers: { Authorization: `Bearer ${user.token}` },
      expectedStatus: userData.httpStatus.unauthorized,
      expectedBody: userData.responses.userNotFound,
    });

    const loginAfterDeletion = await request.post('/Account/v1/GenerateToken', {
      data: user.credentials,
    });
    expect(loginAfterDeletion.status()).toBe(userData.httpStatus.ok);
    expect(await loginAfterDeletion.json()).toMatchObject(userData.responses.loginFailure);
  });

  test('returns 401 for deletion without authorization and keeps the user', async ({ request }) => {
    const response = await request.delete(`/Account/v1/User/${user.userID}`);
    expect(response.status()).toBe(userData.httpStatus.unauthorized);

    const profile = await request.get(`/Account/v1/User/${user.userID}`, {
      headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(profile.status()).toBe(userData.httpStatus.ok);
    expect(await profile.json()).toMatchObject({ userId: user.userID });
  });

  test('returns 401 for an invalid token and keeps the user', async ({ request }) => {
    const response = await request.delete(`/Account/v1/User/${user.userID}`, {
      headers: { Authorization: `Bearer ${userData.invalidToken}` },
    });
    expect(response.status()).toBe(userData.httpStatus.unauthorized);

    const profile = await request.get(`/Account/v1/User/${user.userID}`, {
      headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(profile.status()).toBe(userData.httpStatus.ok);
    expect(await profile.json()).toMatchObject({ userId: user.userID });
  });

  test('returns 200 with an error for a nonexistent user with a valid token', async ({ request }) => {
    const response = await request.delete(`/Account/v1/User/${randomUUID()}`, {
      headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(response.status()).toBe(userData.httpStatus.ok);
    expect(await response.json()).toMatchObject(userData.responses.userNotFound);
  });
});