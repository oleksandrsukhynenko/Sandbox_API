import type { APIResponse } from '@playwright/test';
import { test as apiTest, expect } from '../fixtures/api.fixture';
import { unknownIsbn } from '../data/books.data';
import { login, type User } from '../helpers/user.helper';
import { catalogSchema, collectionSchema, errorSchema, userProfileSchema } from '../helpers/schemas';
import type { AccountService } from '../services/account.service';
import type { CatalogService } from '../services/catalog.service';

const test = apiTest.extend<{ catalogIsbns: string[] }>({
  catalogIsbns: provideCatalogIsbns,
});

test.describe('Collection negative and business-rule coverage', { tag: '@regression' }, () => {
  let response: APIResponse;

  test('missing field: rejects an absent ISBN collection', {
    tag: '@known-issue',
    annotation: { type: 'issue', description: 'KNOWN-001: absent collectionOfIsbns returns 500 instead of a validation error.' },
  }, async ({ accounts, collection, authenticatedUser: user }) => {
    await test.step('Submit a request without collectionOfIsbns', async () => {
      response = await collection.add({ userId: user.userID }, user.token);
    });
    await test.step('Verify validation failure and unchanged collection', async () => {
      expect(await readIsbns(accounts, user)).toEqual([]);
      test.fail(response.status() === 500,
        'KNOWN-001: DemoQA returns 500 instead of a validation error when collectionOfIsbns is absent.');
      expect(response.status()).toBe(400);
      expect(errorSchema.parse(await response.json()).code).toBe('1200');
    });
  });

  test('invalid value: rejects an empty ISBN', async ({ accounts, collection, authenticatedUser: user }) => {
    await test.step('Attempt to add an empty ISBN', async () => {
      response = await collection.add({ userId: user.userID, collectionOfIsbns: [{ isbn: '' }] }, user.token);
    });
    await test.step('Verify an invalid book was not added', async () => {
      expect(response.status()).toBe(400);
      expect(errorSchema.parse(await response.json()).code).toBe('1205');
      expect(await readIsbns(accounts, user)).toEqual([]);
    });
  });

  test('unauthorized: rejects adding a book without a token', async ({ accounts, collection, authenticatedUser: user, catalogIsbns }) => {
    const [isbn] = catalogIsbns;
    await test.step('Attempt to add a valid book without authorization', async () => {
      response = await collection.add({ userId: user.userID, collectionOfIsbns: [{ isbn }] });
    });
    await test.step('Verify unauthorized access did not modify the collection', async () => {
      expect(response.status()).toBe(401);
      errorSchema.parse(await response.json());
      expect(await readIsbns(accounts, user)).toEqual([]);
    });
  });

  test('business rule: rejects an ISBN absent from the catalog', async ({ accounts, collection, authenticatedUser: user }) => {
    await test.step('Attempt to add an ISBN absent from the catalog', async () => {
      response = await collection.add({ userId: user.userID, collectionOfIsbns: [{ isbn: unknownIsbn }] }, user.token);
    });
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
      response = await collection.add(data, user.token);
      expect(response.status()).toBe(201);
      expect(collectionSchema.parse(await response.json()).books).toEqual([{ isbn }]);
    });

    await test.step('Attempt to add the same ISBN again', async () => {
      response = await collection.add(data, user.token);
    });
    await test.step('Verify duplicate rejection preserves the single original book', async () => {
      expect(response.status()).toBe(400);
      expect(errorSchema.parse(await response.json()).code).toBe('1210');
      expect(await readIsbns(accounts, user)).toEqual([isbn]);
    });
  });

  test('ownership: rejects adding a book to another user collection', async ({ accounts, collection, authenticatedUser: user, otherUser: other, catalogIsbns }) => {
    const [isbn] = catalogIsbns;
    await test.step('Authorize the other collection owner', () => login(accounts, other));
    await test.step('Attempt to modify another user collection with the original token', async () => {
      response = await collection.add({ userId: other.userID, collectionOfIsbns: [{ isbn }] }, user.token);
    });
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
      response = await collection.add({ userId: user.userID, collectionOfIsbns: [{ isbn }] }, user.token);
      expect(response.status()).toBe(201);
    });
    await test.step('Attempt to replace the book with an unknown ISBN', async () => {
      response = await collection.replace(isbn, { userId: user.userID, isbn: unknownIsbn }, user.token);
    });
    await test.step('Verify a rejected replacement does not remove the original book', async () => {
      expect(response.status()).toBe(400);
      expect(errorSchema.parse(await response.json()).code).toBe('1205');
      expect(await readIsbns(accounts, user)).toEqual([isbn]);
    });
  });

  for (const invalidFirst of [false, true]) {
    test(`mixed batch: success response matches persisted books (${invalidFirst ? 'invalid first' : 'valid first'})`, {
      tag: '@known-issue',
      annotation: { type: 'issue', description: 'KNOWN-002: mixed batches echo unknown ISBNs despite persisting only valid books.' },
    }, async ({ accounts, collection, authenticatedUser: user, catalogIsbns }) => {
      const [isbn] = catalogIsbns;
      const isbns = invalidFirst ? [unknownIsbn, isbn] : [isbn, unknownIsbn];
      await test.step('Submit a mixed batch of valid and unknown ISBNs', async () => {
        response = await collection.add({
          userId: user.userID,
          collectionOfIsbns: isbns.map(isbn => ({ isbn })),
        }, user.token);
      });
      await test.step('Verify the success response contains only books actually persisted', async () => {
        const persistedIsbns = await readIsbns(accounts, user);
        const returnedIsbns = collectionSchema.parse(await response.json()).books.map(book => book.isbn);
        test.fail(response.status() === 201
          && returnedIsbns.length === isbns.length
          && returnedIsbns.every((returnedIsbn, index) => returnedIsbn === isbns[index])
          && persistedIsbns.length === 1 && persistedIsbns[0] === isbn,
        'KNOWN-002: mixed batches report unknown ISBNs as added despite persisting only valid books.');
        expect(response.status()).toBe(201);
        expect([...returnedIsbns].sort()).toEqual([...persistedIsbns].sort());
        expect(returnedIsbns).not.toContain(unknownIsbn);
        expect(persistedIsbns).toEqual([isbn]);
      });
    });
  }

  for (const size of [0, 1, 2]) {
    test(`collection size boundary: ${size === 0 ? 'rejects' : 'adds'} ${size} books`, async ({ accounts, collection, authenticatedUser: user, catalogIsbns }) => {
      const selected = await test.step(`Select ${size} books for the collection-size boundary`, async () => {
        expect(catalogIsbns.length).toBeGreaterThanOrEqual(size);
        return catalogIsbns.slice(0, size);
      });
      await test.step(`Submit a collection containing ${size} books`, async () => {
        response = await collection.add({
          userId: user.userID,
          collectionOfIsbns: selected.map(isbn => ({ isbn })),
        }, user.token);
      });
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

/**
 * Reads persisted ISBNs so failed writes are checked for unintended side effects.
 * @param accounts - Account service used to retrieve the persisted user profile.
 * @param user - Collection owner whose user ID and token authorize the profile request.
 * @returns The ISBNs currently stored in the user's collection.
 */
async function readIsbns(accounts: AccountService, user: User): Promise<string[]> {
  return test.step('Read persisted collection ISBNs', async () => {
    const response = await accounts.getById(user.userID, user.token);
    expect(response.status()).toBe(200);
    return userProfileSchema.parse(await response.json()).books.map(book => book.isbn);
  });
}

/**
 * Fetches the public catalog, verifies HTTP 200 and validates the response schema.
 * Extracts book ISBNs, removes duplicates and passes the array to the dependent test.
 * Tests use real catalog books without hardcoding ISBNs or creating users here.
 * @param fixtures - Test fixtures; catalog provides access to the public book catalog.
 * @param use - Passes the unique ISBN array to the dependent test.
 */
async function provideCatalogIsbns(
  { catalog }: { catalog: CatalogService },
  use: (isbns: string[]) => Promise<void>,
): Promise<void> {
  const response = await catalog.getAll();
  expect(response.status()).toBe(200);
  const isbns = [...new Set(catalogSchema.parse(await response.json()).books.map(book => book.isbn))];
  await use(isbns);
}