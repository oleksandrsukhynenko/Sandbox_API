import { test as apiTest, expect } from '../fixtures/api.fixture';
import { unknownIsbn } from '../data/books.data';
import { login, type User } from '../helpers/user.helper';
import { catalogSchema, collectionSchema, errorSchema, userProfileSchema } from '../helpers/schemas';
import type { AccountService } from '../services/account.service';

const test = apiTest.extend<{ catalogIsbns: string[] }>({
  /** Supplies distinct catalog ISBNs without creating or owning test users. */
  catalogIsbns: async ({ catalog }, use) => {
    const isbns = await test.step('Select valid ISBNs from the catalog', async () => {
      const response = await catalog.getAll();
      expect(response.status()).toBe(200);
      return [...new Set(catalogSchema.parse(await response.json()).books.map(book => book.isbn))];
    });
    await use(isbns);
  },
});

/** Reads persisted ISBNs so failed writes are checked for unintended side effects. */
async function readIsbns(accounts: AccountService, user: User): Promise<string[]> {
  return test.step('Read persisted collection ISBNs', async () => {
    const response = await accounts.getById(user.userID, user.token);
    expect(response.status()).toBe(200);
    return userProfileSchema.parse(await response.json()).books.map(book => book.isbn);
  });
}

test.describe('Collection negative and business-rule coverage', { tag: '@regression' }, () => {
  test('missing field: rejects an absent ISBN collection', {
    tag: '@known-issue',
    annotation: { type: 'issue', description: 'KNOWN-001: absent collectionOfIsbns returns 500 instead of a validation error.' },
  }, async ({ accounts, collection, authenticatedUser: user }) => {
    const response = await test.step('Submit a request without collectionOfIsbns', () =>
      collection.add({ userId: user.userID }, user.token));
    await test.step('Verify validation failure and unchanged collection', async () => {
      expect(await readIsbns(accounts, user)).toEqual([]);
      test.fail(response.status() === 500,
        'KNOWN-001: DemoQA returns 500 instead of a validation error when collectionOfIsbns is absent.');
      expect(response.status()).toBe(400);
      expect(errorSchema.parse(await response.json()).code).toBe('1200');
    });
  });

  test('invalid value: rejects an empty ISBN', async ({ accounts, collection, authenticatedUser: user }) => {
    const response = await test.step('Attempt to add an empty ISBN', () =>
      collection.add({ userId: user.userID, collectionOfIsbns: [{ isbn: '' }] }, user.token));
    await test.step('Verify an invalid book was not added', async () => {
      expect(response.status()).toBe(400);
      expect(errorSchema.parse(await response.json()).code).toBe('1205');
      expect(await readIsbns(accounts, user)).toEqual([]);
    });
  });

  test('unauthorized: rejects adding a book without a token', async ({ accounts, collection, authenticatedUser: user, catalogIsbns }) => {
    const [isbn] = catalogIsbns;
    const response = await test.step('Attempt to add a valid book without authorization', () =>
      collection.add({ userId: user.userID, collectionOfIsbns: [{ isbn }] }));
    await test.step('Verify unauthorized access did not modify the collection', async () => {
      expect(response.status()).toBe(401);
      errorSchema.parse(await response.json());
      expect(await readIsbns(accounts, user)).toEqual([]);
    });
  });

  test('business rule: rejects an ISBN absent from the catalog', async ({ accounts, collection, authenticatedUser: user }) => {
    const response = await test.step('Attempt to add an ISBN absent from the catalog', () =>
      collection.add({ userId: user.userID, collectionOfIsbns: [{ isbn: unknownIsbn }] }, user.token));
    await test.step('Verify catalog membership is required', async () => {
      expect(response.status()).toBe(400);
      expect(errorSchema.parse(await response.json()).code).toBe('1205');
      expect(await readIsbns(accounts, user)).toEqual([]);
    });
  });

  test('duplicate: rejects adding an already owned ISBN', async ({ accounts, collection, authenticatedUser: user, catalogIsbns }) => {
    const [isbn] = catalogIsbns;
    const data = { userId: user.userID, collectionOfIsbns: [{ isbn }] };
    await test.step('Add the original book and verify successful creation', async () => {
      const first = await collection.add(data, user.token);
      expect(first.status()).toBe(201);
      expect(collectionSchema.parse(await first.json()).books).toEqual([{ isbn }]);
    });

    const duplicate = await test.step('Attempt to add the same ISBN again', () => collection.add(data, user.token));
    await test.step('Verify duplicate rejection preserves the single original book', async () => {
      expect(duplicate.status()).toBe(400);
      expect(errorSchema.parse(await duplicate.json()).code).toBe('1210');
      expect(await readIsbns(accounts, user)).toEqual([isbn]);
    });
  });

  test('ownership: rejects adding a book to another user collection', async ({ accounts, collection, authenticatedUser: user, otherUser: other, catalogIsbns }) => {
    const [isbn] = catalogIsbns;
    await test.step('Authorize the other collection owner', () => login(accounts, other));
    const response = await test.step('Attempt to modify another user collection with the original token', () =>
      collection.add({ userId: other.userID, collectionOfIsbns: [{ isbn }] }, user.token));
    await test.step('Verify both collections remain unchanged', async () => {
      expect(response.status()).toBe(401);
      errorSchema.parse(await response.json());
      expect(await readIsbns(accounts, user)).toEqual([]);
      expect(await readIsbns(accounts, other)).toEqual([]);
    });
  });

  test('failed replacement: keeps the original ISBN when the replacement does not exist', async ({ accounts, collection, authenticatedUser: user, catalogIsbns }) => {
    const [isbn] = catalogIsbns;
    await test.step('Add the original book before attempting replacement', async () => {
      const added = await collection.add({ userId: user.userID, collectionOfIsbns: [{ isbn }] }, user.token);
      expect(added.status()).toBe(201);
    });
    const response = await test.step('Attempt to replace the book with an unknown ISBN', () =>
      collection.replace(isbn, { userId: user.userID, isbn: unknownIsbn }, user.token));
    await test.step('Verify a rejected replacement does not remove the original book', async () => {
      expect(response.status()).toBe(400);
      expect(errorSchema.parse(await response.json()).code).toBe('1205');
      expect(await readIsbns(accounts, user)).toEqual([isbn]);
    });
  });

  for (const invalidFirst of [false, true]) {
    test(`mixed batch: documents partial persistence (${invalidFirst ? 'invalid first' : 'valid first'}) despite a success response`, {
      tag: '@known-issue',
      annotation: { type: 'issue', description: 'KNOWN-002: mixed batches echo unknown ISBNs despite persisting only valid books.' },
    }, async ({ accounts, collection, authenticatedUser: user, catalogIsbns }) => {
      const [isbn] = catalogIsbns;
      const isbns = invalidFirst ? [unknownIsbn, isbn] : [isbn, unknownIsbn];
      const response = await test.step('Submit a mixed batch of valid and unknown ISBNs', () =>
        collection.add({
          userId: user.userID,
          collectionOfIsbns: isbns.map(isbn => ({ isbn })),
        }, user.token));
      await test.step('Document KNOWN-002: response echoes all ISBNs but only valid books persist', async () => {
        expect(response.status()).toBe(201);
        expect(collectionSchema.parse(await response.json()).books).toEqual(isbns.map(isbn => ({ isbn })));
        expect(await readIsbns(accounts, user)).toEqual([isbn]);
      });
    });
  }

  for (const size of [0, 1, 2]) {
    test(`collection size boundary: ${size === 0 ? 'rejects' : 'adds'} ${size} books`, async ({ accounts, collection, authenticatedUser: user, catalogIsbns }) => {
      const selected = await test.step(`Select ${size} books for the collection-size boundary`, async () => {
        expect(catalogIsbns.length).toBeGreaterThanOrEqual(size);
        return catalogIsbns.slice(0, size);
      });
      const response = await test.step(`Submit a collection containing ${size} books`, () =>
        collection.add({
          userId: user.userID,
          collectionOfIsbns: selected.map(isbn => ({ isbn })),
        }, user.token));
      await test.step('Verify empty, single-item and multi-item collection boundaries', async () => {
        expect(response.status()).toBe(size === 0 ? 400 : 201);
        if (size === 0) {
          errorSchema.parse(await response.json());
        } else {
          expect(collectionSchema.parse(await response.json()).books).toEqual(selected.map(isbn => ({ isbn })));
        }
        expect(await readIsbns(accounts, user)).toEqual(selected);
      });
    });
  }
});