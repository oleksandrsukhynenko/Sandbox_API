import { test, expect } from '@playwright/test';
import { createUserCredentials, userData } from '../data/users.data';
import { createUser, login, cleanupUser } from '../helpers/user.helper';
import { userProfileSchema } from '../helpers/schemas';
import { sendRawCredentials } from '../helpers/raw-http.helper';

test.describe('Account API encoding and content types', () => {
  test('preserves special characters in the username', async ({ request }) => {
    test.fixme(true, 'DemoQA GenerateToken returns 500 for this username; token-based cleanup cannot complete.');
    const credentials = createUserCredentials();
    credentials.userName = `api_+&?%#_${credentials.userName}`;
    const user = await createUser(request, credentials);

    try {
      expect(user.registration.username).toBe(credentials.userName);
      await login(request, user);
      const response = await request.get(`/Account/v1/User/${user.userID}`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      expect(response.status()).toBe(userData.httpStatus.ok);
      const profile = userProfileSchema.parse(await response.json());
      expect(profile.username).toBe(credentials.userName);
    } finally {
      await cleanupUser(request, user);
    }
  });

  for (const { name, contentType } of [
    { name: 'missing Content-Type', contentType: undefined },
    { name: 'incorrect text/plain Content-Type', contentType: 'text/plain' },
  ]) {
    test(`documents current 500 HTML error for ${name}`, async ({ baseURL }) => {
      expect(baseURL, 'BASE_URL must be configured').toBeTruthy();
      const response = await sendRawCredentials(baseURL!, contentType);
      expect(response.sentContentType).toBe(contentType);
      expect(response.status).toBe(500);
      expect(response.contentType).toMatch(/^text\/html(?:\s*;|$)/i);
      expect(response.body).toContain('TypeError');
    });
  }
});