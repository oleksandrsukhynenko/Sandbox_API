import { performance } from 'node:perf_hooks';
import { test, expect } from '../fixtures/api.fixture';
import { catalogSchema, collectionSchema, userProfileSchema } from '../helpers/schemas';
import { userData } from '../data/users.data';

test.describe('BookStore API', { tag: '@regression' }, () => {
  test('returns a nonempty valid catalog within the response time budget', { tag: '@smoke' }, async ({ catalog: catalogService, authenticatedUser: _user }) => {
    const maxResponseTime = Number(process.env.API_MAX_RESPONSE_TIME_MS ?? 10000);
    await test.step('Validate the response time budget', async () => {
      expect(Number.isFinite(maxResponseTime) && maxResponseTime > 0).toBe(true);
    });
    const { response, elapsed } = await test.step('Request the book catalog and measure response time', async () => {
      const startedAt = performance.now();
      const response = await catalogService.getAll();
      const elapsed = performance.now() - startedAt;
      return { response, elapsed };
    });

    await test.step('Verify response status, content type and response time', async () => {
      expect(response.status()).toBe(userData.httpStatus.ok);
      expect(response.headers()['content-type']).toMatch(/^application\/json(?:\s*;|$)/i);
      expect(elapsed, `Catalog request took ${elapsed.toFixed(0)} ms`).toBeLessThan(maxResponseTime);
    });
    await test.step('Validate the catalog schema and book properties', async () => {
      const body = catalogSchema.parse(await response.json());
      expect(body.books.length).toBeGreaterThan(0);
      expect(body.books.every(book =>
        book.isbn.length > 0 && book.title.length > 0 && book.author.length > 0 && book.pages > 0,
      )).toBe(true);
      expect(body.books?.[0]?.title).toEqual(expect.any(String));
      const firstBook: { isbn: string; metadata?: { language?: string } } | undefined = body.books[0];
      expect(firstBook?.metadata?.language).toBeUndefined();
      expect(body.books?.[body.books.length]?.title).toBeUndefined();
    });
  });

  test('creates, reads, replaces, deletes a collection book and verifies its absence', { tag: '@smoke' }, async ({ accounts, catalog: catalogService, collection, authenticatedUser: user }) => {
    let originalIsbn: string;
    let replacementIsbn: string;

    await test.step('Select two different books from the catalog', async () => {
      const catalogResponse = await catalogService.getAll();
      expect(catalogResponse.status()).toBe(userData.httpStatus.ok);
      const catalog = catalogSchema.parse(await catalogResponse.json());
      const isbns = [...new Set(catalog.books.map(book => book.isbn))];
      expect(isbns.length, 'Replacement requires two different catalog books').toBeGreaterThanOrEqual(2);
      [originalIsbn, replacementIsbn] = isbns;
    });
    await test.step('Create a book in the user collection', async () => {
      const response = await collection.add({ userId: user.userID, collectionOfIsbns: [{ isbn: originalIsbn }] }, user.token);
      expect(response.status()).toBe(userData.httpStatus.created);
      expect(collectionSchema.parse(await response.json()).books).toEqual([{ isbn: originalIsbn }]);
    });

    await test.step('Read the persisted collection', async () => {
      const response = await accounts.getById(user.userID, user.token);
      expect(response.status()).toBe(userData.httpStatus.ok);
      const profile = userProfileSchema.parse(await response.json());
      expect(profile.books.map(book => book.isbn)).toEqual([originalIsbn]);
    });

    await test.step('Update with PUT and verify persistence', async () => {
      const response = await collection.replace(originalIsbn, { userId: user.userID, isbn: replacementIsbn }, user.token);
      expect(response.status()).toBe(userData.httpStatus.ok);
      expect(userProfileSchema.parse(await response.json()).books.map(book => book.isbn)).toEqual([replacementIsbn]);
      const readResponse = await accounts.getById(user.userID, user.token);
      expect(readResponse.status()).toBe(userData.httpStatus.ok);
      const profile = userProfileSchema.parse(await readResponse.json());
      expect(profile.books.map(book => book.isbn)).toEqual([replacementIsbn]);
      expect(profile.books.some(book => book.isbn === originalIsbn)).toBe(false);
    });

    await test.step('Delete the replacement book', async () => {
      const response = await collection.delete({ userId: user.userID, isbn: replacementIsbn }, user.token);
      expect(response.status()).toBe(userData.httpStatus.noContent);
      expect(await response.text()).toBe(userData.responses.emptyBody);
    });

    await test.step('Verify absence while the user still exists', async () => {
      const response = await accounts.getById(user.userID, user.token);
      expect(response.status()).toBe(userData.httpStatus.ok);
      const profile = userProfileSchema.parse(await response.json());
      expect(profile.userId).toBe(user.userID);
      expect(profile.books).toEqual([]);
    });
  });
});