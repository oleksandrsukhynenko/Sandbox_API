import { randomUUID } from 'node:crypto';
import { test, expect } from '../fixtures/api.fixture';
import { deleteUser } from '../helpers/user.helper';
import { verifyObjectDeleted } from '../helpers/assertions';
import { userData } from '../data/users.data';
import { endpoints } from '../data/endpoints';

test.describe(`DELETE ${endpoints.account.user}/{UUID}`, { tag: '@regression' }, () => {
  test('returns 204 on deletion and prevents subsequent login', async ({ accounts, authenticatedUser: user }) => {
    await test.step('Delete the user and verify the response has no body', async () => {
      const response = await deleteUser(accounts, user);
      expect(await response.text()).toBe(userData.responses.emptyBody);
    });
    await test.step('Verify the deleted profile is no longer accessible', async () => {
      await verifyObjectDeleted(accounts, user.userID, {
        token: user.token,
        expectedStatus: userData.httpStatus.unauthorized,
        expectedBody: userData.responses.userNotFound,
      });
    });

    const loginAfterDeletion = await test.step('Attempt token generation after deletion', () => accounts.generateToken(user.credentials));
    await test.step('Verify the deleted user cannot obtain a new token', async () => {
      expect(loginAfterDeletion.status()).toBe(userData.httpStatus.ok);
      expect(await loginAfterDeletion.json()).toMatchObject(userData.responses.loginFailure);
    });
  });

  test('returns 401 for deletion without authorization and keeps the user', async ({ accounts, authenticatedUser: user }) => {
    await test.step('Attempt deletion without authorization and verify 401', async () => {
      const response = await accounts.delete(user.userID);
      expect(response.status()).toBe(userData.httpStatus.unauthorized);
    });

    await test.step('Verify the user still exists after unauthorized deletion', async () => {
      const profile = await accounts.getById(user.userID, user.token);
      //repetative code with 51 rows, we can create a helper function to verify the profile exists and has the expected userId
      expect(profile.status()).toBe(userData.httpStatus.ok);
      expect(await profile.json()).toMatchObject({ userId: user.userID });
    });
  });

  test('returns 401 for an invalid token and keeps the user', async ({ accounts, authenticatedUser: user }) => {
    await test.step('Attempt deletion with an invalid token and verify 401', async () => {
      const response = await accounts.delete(user.userID, userData.invalidToken);
      expect(response.status()).toBe(userData.httpStatus.unauthorized);
    });

    await test.step('Verify the user still exists after deletion with an invalid token', async () => {
      const profile = await accounts.getById(user.userID, user.token);
      expect(profile.status()).toBe(userData.httpStatus.ok);
      expect(await profile.json()).toMatchObject({ userId: user.userID });
    });
  });

  test('returns 200 with an error for a nonexistent user with a valid token', async ({ accounts, authenticatedUser: user }) => {
    const response = await test.step('Attempt deletion of a nonexistent user with a valid token', () =>
      accounts.delete(randomUUID(), user.token));
    await test.step('Verify the response contains the expected user-not-found error', async () => {
      expect(response.status()).toBe(userData.httpStatus.ok);
      expect(await response.json()).toMatchObject(userData.responses.userNotFound);
    });
  });

  //helper function
});