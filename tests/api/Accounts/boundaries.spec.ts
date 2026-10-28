import type { APIResponse } from '@playwright/test';
import { test, expect } from '../fixtures/api.fixture';
import { createUserCredentials, userData, type UserCredentials } from '../data/users.data';
import { cleanupUser, type User } from '../helpers/user.helper';
import { errorSchema, registrationSchema } from '../helpers/schemas';

const cases = [
  { name: 'username: empty (below required minimum)', field: 'userName', value: '', expectedStatus: 400, errorCode: '1200' },
  { name: 'password: 7 characters (below minimum)', field: 'password', value: 'Aa!1234', expectedStatus: 400, errorCode: '1300' },
  { name: 'password: 8 characters (minimum)', field: 'password', value: 'Aa!12345', expectedStatus: 201 },
  { name: 'password: 9 characters (above minimum)', field: 'password', value: 'Aa!123456', expectedStatus: 201 },
] as const;

test.describe('Account required-field and password boundaries', { tag: '@regression' }, () => {
  let response: APIResponse;
  let credentials: UserCredentials;
  let user: User | undefined;

  test.beforeEach(async () => {
    credentials = createUserCredentials();
    user = undefined;
  });

  test.afterEach(async ({ accounts }) => {
    if (user) {
      await cleanupUser(accounts, user);
    }
  });

  for (const data of cases) {
    test(data.name, async ({ accounts }) => {
      await test.step(`Prepare the selected boundary: ${data.name}`, async () => {
        credentials[data.field] = data.value;
      });
      await test.step('Submit credentials and track any created account for cleanup', async () => {
        response = await accounts.create(credentials);
        if (response.status() === userData.httpStatus.created) {
          const registration = registrationSchema.parse(await response.json());
          user = { credentials, userID: registration.userID, registration, deleted: false };
        }
      });

      await test.step(`Verify the boundary response has HTTP status ${data.expectedStatus} and the expected body`, async () => {
        expect(response.status()).toBe(data.expectedStatus);
        if ('errorCode' in data) {
          expect(errorSchema.parse(await response.json()).code).toBe(data.errorCode);
        } else {
          expect(user!.registration.username).toBe(credentials.userName);
        }
      });
    });
  }
});