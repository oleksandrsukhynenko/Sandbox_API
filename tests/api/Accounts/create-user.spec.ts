import { test, expect } from '../fixtures/api.fixture';
import { login } from '../helpers/user.helper';
import { verifyObjectCreated } from '../helpers/assertions';
import { userData } from '../data/users.data';
import { endpoints } from '../data/endpoints';

test.describe(`POST ${endpoints.account.user}`, { tag: '@regression' }, () => {
  test('returns 201 and creates a user with an empty book collection', { tag: '@smoke' }, async ({ accounts, user }) => {
    await test.step('Verify the registered user ID, username and empty collection', async () => {
      expect(user.userID).toMatch(userData.uuidPattern);
      expect(user.registration).toEqual({
        userID: user.userID,
        username: user.credentials.userName,
        books: userData.responses.emptyBooks,
      });
    });
    await test.step('Authorize the newly registered user', () => login(accounts, user));
    await test.step('Verify the created user is persisted and accessible by ID', async () => {
      await verifyObjectCreated(accounts, user.userID, {
        userId: user.userID,
        username: user.credentials.userName,
        books: userData.responses.emptyBooks,
      }, user.token);
    });
  });

  test('returns 406 for a duplicate username', async ({ accounts, user }) => {
    const response = await test.step('Attempt registration with an existing username', () => accounts.create(user.credentials));
    await test.step('Verify duplicate registration is rejected with 406', async () => {
      expect(response.status()).toBe(userData.httpStatus.duplicateUser);
      expect(await response.json()).toMatchObject(userData.responses.duplicateUser);
    });
  });

  for (const { name, credentials } of userData.missingCredentialsCases) {
    test(`returns 400 for ${name}`, async ({ accounts, user: _user }) => {
      const response = await test.step(`Attempt registration with ${name}`, () => accounts.create(credentials));
      await test.step('Verify missing or empty credentials are rejected with 400', async () => {
        expect(response.status()).toBe(userData.httpStatus.badRequest);
        expect(await response.json()).toMatchObject(userData.responses.invalidCredentials);
      });
    });
  }

  for (const { name, password } of userData.weakPasswordCases) {
    test(`returns 400 for a password ${name}`, async ({ accounts, user }) => {
      const response = await test.step(`Attempt registration with a password ${name}`, () =>
        accounts.create({ ...user.credentials, password }));
      await test.step('Verify the password policy rejects the request with 400', async () => {
        expect(response.status()).toBe(userData.httpStatus.badRequest);
        expect(await response.json()).toMatchObject(userData.responses.weakPassword);
      });
    });
  }
});