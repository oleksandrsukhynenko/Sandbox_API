import { test as apiTest, expect } from '../fixtures/api.fixture';
import { createUserCredentials, userData } from '../data/users.data';
import { tokenSchema, userProfileSchema } from '../helpers/schemas';
import { sendRawCredentials } from '../helpers/raw-http.helper';
//describe how it works, what is the purpose of this test, what is the expected outcome
//maybe use before
const test = apiTest.extend({
  userCredentials: async ({}, use) => {
    const credentials = createUserCredentials();
    credentials.userName = `api_+&?%#_${credentials.userName}`;
    await use(credentials);
  },
});

test.describe('Account API encoding and content types', { tag: '@regression' }, () => {
  test('preserves special characters in the username', {
    //descfribe this type of tad and annotation
    tag: '@known-issue',
    annotation: { type: 'issue', description: 'KNOWN-003: GenerateToken returns 500 for a registered username containing +&?%#.' },
  }, async ({ accounts, user }) => {
    await test.step('Verify registration preserves the original username', async () => {
      expect(user.registration.username).toBe(user.credentials.userName);
    });
    const tokenResponse = await test.step('Generate a token for the special-character user', () => accounts.generateToken(user.credentials));
    await test.step('Verify token generation succeeds rather than reproducing KNOWN-003', async () => {
      test.fail(tokenResponse.status() === 500,
        'KNOWN-003: registered special-character usernames cause GenerateToken to return 500.');
      expect(tokenResponse.status()).toBe(userData.httpStatus.ok);
      const body = tokenSchema.parse(await tokenResponse.json());
      user.token = body.token;
      expect(Date.parse(body.expires)).toBeGreaterThan(Date.now());
    });
    const response = await test.step('Read the persisted profile with a valid token', () => accounts.getById(user.userID, user.token));
    await test.step('Verify the profile schema and exact username round trip', async () => {
      expect(response.status()).toBe(userData.httpStatus.ok);
      const profile = userProfileSchema.parse(await response.json());
      expect(profile.username).toBe(user.credentials.userName);
    });
  });

  for (const { name, contentType } of [
    { name: 'missing Content-Type', contentType: undefined },
    { name: 'incorrect text/plain Content-Type', contentType: 'text/plain' },
  ]) {
    test(`documents current 500 HTML error for ${name}`, {
      tag: '@known-issue',
      annotation: { type: 'issue', description: 'KNOWN-004: missing or incorrect Content-Type produces a 500 HTML error.' },
    }, async ({ baseURL }) => {
      await test.step('Verify the API base URL is configured', async () => {
        expect(baseURL, 'BASE_URL must be configured').toBeTruthy();
      });
      const response = await test.step(`Send a raw request with ${name}`, () => sendRawCredentials(baseURL!, contentType));
      await test.step('Verify the outgoing Content-Type and characterize the current 500 HTML error', async () => {
        expect(response.sentContentType).toBe(contentType);
        expect(response.status).toBe(500);
        expect(response.contentType).toMatch(/^text\/html(?:\s*;|$)/i);
        expect(response.body).toContain('TypeError');
      });
    });
  }
});