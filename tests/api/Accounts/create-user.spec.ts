import { test, expect } from '@playwright/test';
import { createUser, login, cleanupUser, type User } from '../helpers/user.helper';
import { verifyObjectCreated } from '../helpers/assertions';
import { userData } from '../data/users.data';
import { endpoints } from '../data/endpoints';

test.describe(`POST ${endpoints.account.user}`, () => {
  let user: User;

  test.beforeEach(async ({ request }) => {
    user = await createUser(request);
  });

  test.afterEach(async ({ request }) => {
    if (user) {
      await cleanupUser(request, user);
    }
  });

  test('returns 201 and creates a user with an empty book collection', async ({ request }) => {
    expect(user.userID).toMatch(userData.uuidPattern);
    expect(user.registration).toEqual({
      userID: user.userID,
      username: user.credentials.userName,
      books: userData.responses.emptyBooks,
    });
    await login(request, user);
    await verifyObjectCreated(request, endpoints.account.user, user.userID, {
      userId: user.userID,
      username: user.credentials.userName,
      books: userData.responses.emptyBooks,
    }, {
      headers: { Authorization: `Bearer ${user.token}` },
    });
  });

  test('returns 406 for a duplicate username', async ({ request }) => {
    const response = await request.post(endpoints.account.user, {
      data: user.credentials,
    });
    expect(response.status()).toBe(userData.httpStatus.duplicateUser);
    expect(await response.json()).toMatchObject(userData.responses.duplicateUser);
  });

  for (const { name, credentials } of userData.missingCredentialsCases) {
    test(`returns 400 for ${name}`, async ({ request }) => {
      const response = await request.post(endpoints.account.user, { data: credentials });
      expect(response.status()).toBe(userData.httpStatus.badRequest);
      expect(await response.json()).toMatchObject(userData.responses.invalidCredentials);
    });
  }

  for (const { name, password } of userData.weakPasswordCases) {
    test(`returns 400 for a password ${name}`, async ({ request }) => {
      const response = await request.post(endpoints.account.user, {
        data: { ...user.credentials, password },
      });
      expect(response.status()).toBe(userData.httpStatus.badRequest);
      expect(await response.json()).toMatchObject(userData.responses.weakPassword);
    });
  }
});