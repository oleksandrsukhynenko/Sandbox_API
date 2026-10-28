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
  let credentials: UserCredentials;
  let user: User | undefined;

  test.beforeEach(async () => {
    //do we nneed steps if there is only one step?
    await test.step('Generate unique default credentials and reset cleanup state', async () => {
      credentials = createUserCredentials();
      user = undefined;
    });
  });

  test.afterEach(async ({ accounts }) => {
    if (user) {
      await test.step('Clean up the boundary-test account', () => cleanupUser(accounts, user!));
    }
  });

  for (const data of cases) {
    test(data.name, async ({ accounts }) => {
      await test.step(`Prepare the selected boundary: ${data.name}`, async () => {
        credentials[data.field] = data.value;
      });
//create general response variable and reuse it in all tests
      const response = await test.step('Submit credentials and track any created account for cleanup', async () => {
        const response = await accounts.create(credentials);
        if (response.status() === userData.httpStatus.created) {
          const registration = registrationSchema.parse(await response.json());
          user = { credentials, userID: registration.userID, registration, deleted: false };
        }
        return response;
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