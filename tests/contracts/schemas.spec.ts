import { test, expect } from '@playwright/test';
import { createUserCredentials } from '../api/data/users.data';
import { collectionSchema, registrationSchema, tokenSchema } from '../api/helpers/schemas';

const token = {
  token: 'test-token',
  expires: '2030-01-01T00:00:00Z',
  status: 'Success',
  result: 'User authorized successfully.',
};

const mutations = [
  { name: 'removed field', body: { ...token, token: undefined } },
  { name: 'renamed field', body: { ...token, token: undefined, accessToken: token.token } },
  { name: 'mistyped field', body: { ...token, expires: 123 } },
  { name: 'unexpected field', body: { ...token, internalToken: 'unexpected' } },
];

test.describe('Closed response contracts', { tag: '@regression' }, () => {
  for (const data of mutations) {
    test(`token schema rejects a ${data.name}`, async () => {
      await test.step('Verify the reference token response satisfies the schema', async () => {
        expect(tokenSchema.safeParse(token).success).toBe(true);
      });
      await test.step(`Verify the token schema rejects the ${data.name}`, async () => {
        expect(tokenSchema.safeParse(data.body).success).toBe(false);
      });
    });
  }

  test('registration and collection schemas reject unexpected fields', async () => {
    const registration = {
      userID: 'b997e54e-49da-47c5-8e4f-0cd84e175b90',
      username: 'contract-user',
      books: [],
    };
    await test.step('Verify registration accepts the reference body and rejects an unexpected password field', async () => {
      expect(registrationSchema.safeParse(registration).success).toBe(true);
      expect(registrationSchema.safeParse({ ...registration, password: 'unexpected' }).success).toBe(false);
    });
    await test.step('Verify collection items accept ISBNs and reject unexpected internal fields', async () => {
      expect(collectionSchema.safeParse({ books: [{ isbn: '9781449325862' }] }).success).toBe(true);
      expect(collectionSchema.safeParse({ books: [{ isbn: '9781449325862', internal: true }] }).success).toBe(false);
    });
  });

  test('credential factory applies overrides without sharing generated usernames', async () => {
    const { first, second } = await test.step('Build credentials with a password override and with defaults', async () => ({
      first: createUserCredentials({ password: 'Aa!12345' }),
      second: createUserCredentials(),
    }));
    await test.step('Verify the override is applied without sharing generated values', async () => {
      expect(first.password).toBe('Aa!12345');
      expect(first.userName).not.toBe(second.userName);
      expect(second.password).not.toBe(first.password);
    });
  });
});