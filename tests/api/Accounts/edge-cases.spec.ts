import type { APIResponse } from '@playwright/test';
import { test as apiTest, expect } from '../fixtures/api.fixture';
import { createUserCredentials, userData } from '../data/users.data';
import { errorSchema, tokenSchema, userProfileSchema } from '../helpers/schemas';
import { sendRawCredentials } from '../helpers/raw-http.helper';

/**
 * Overrides the default unique credentials with a username containing +&?%#.
 * The existing user fixture still registers and cleans up the account using these credentials.
 * Default credentials do not exercise special-character handling; this override supplies them
 * before registration, unlike changing the username in a beforeEach hook after user setup.
 * The test expects registration, token generation and profile lookup to preserve the username.
 */
const test = apiTest.extend({
  userCredentials: async ({}, use) => {
    const credentials = createUserCredentials();
    credentials.userName = `api_+&?%#_${credentials.userName}`;
    await use(credentials);
  },
});

test.describe('Account API encoding and content types', { tag: '@regression' }, () => {
  let response: APIResponse;
  let rawResponse: Awaited<ReturnType<typeof sendRawCredentials>>;

  test('preserves special characters in the username @known-issue', async ({ accounts, user }) => {
    // KNOWN-003: GenerateToken returns 500 for a registered username containing +&?%#.

    await test.step('Verify registration preserves the original username', async () => {
      expect(user.registration.username).toBe(user.credentials.userName);
    });
    await test.step('Generate a token for the special-character user', async () => {
      response = await accounts.generateToken(user.credentials);
    });
    await test.step('Verify token generation succeeds rather than reproducing KNOWN-003', async () => {
      test.fail(response.status() === 500,
        'KNOWN-003: registered special-character usernames cause GenerateToken to return 500.');
      expect(response.status()).toBe(userData.httpStatus.ok);
      const body = tokenSchema.parse(await response.json());
      user.token = body.token;
      expect(Date.parse(body.expires)).toBeGreaterThan(Date.now());
    });
    await test.step('Read the persisted profile with a valid token', async () => {
      response = await accounts.getById(user.userID, user.token);
    });
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
    test(`rejects ${name} with a JSON client error`, {
      tag: '@known-issue',
      annotation: { type: 'issue', description: 'KNOWN-004: missing or incorrect Content-Type produces a 500 HTML error.' },
    }, async ({ baseURL }) => {
      await test.step('Verify the API base URL is configured', async () => {
        expect(baseURL, 'BASE_URL must be configured').toBeTruthy();
      });
      await test.step(`Send a raw request with ${name}`, async () => {
        rawResponse = await sendRawCredentials(baseURL!, contentType);
      });
      await test.step('Verify the outgoing Content-Type and a controlled JSON client error', async () => {
        expect(rawResponse.sentContentType).toBe(contentType);
        test.fail(rawResponse.status === 500
          && /^text\/html(?:\s*;|$)/i.test(rawResponse.contentType ?? '')
          && rawResponse.body.includes('TypeError'),
        'KNOWN-004: missing or incorrect Content-Type produces a 500 HTML TypeError.');
        expect([400, 415]).toContain(rawResponse.status);
        expect(rawResponse.contentType).toMatch(/^application\/json(?:\s*;|$)/i);
        errorSchema.parse(JSON.parse(rawResponse.body));
      });
    });
  }
});