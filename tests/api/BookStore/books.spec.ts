import { performance } from 'node:perf_hooks';
import { test, expect } from '@playwright/test';
import { z } from 'zod';
import { bookSchema, userProfileSchema } from '../helpers/schemas';
import { createUser, login, cleanupUser } from '../helpers/user.helper';
import { userData } from '../data/users.data';

const catalogSchema = z.object({ books: z.array(bookSchema).min(1) });

test.describe('BookStore API', () => {
  test('returns a nonempty valid catalog within the response time budget', async ({ request }) => {
    const maxResponseTime = Number(process.env.API_MAX_RESPONSE_TIME_MS ?? 10000);
    expect(Number.isFinite(maxResponseTime) && maxResponseTime > 0).toBe(true);
    const startedAt = performance.now();
    const response = await request.get('/BookStore/v1/Books');
    const elapsed = performance.now() - startedAt;

    expect(response.status()).toBe(userData.httpStatus.ok);
    expect(response.headers()['content-type']).toMatch(/^application\/json(?:\s*;|$)/i);
    expect(elapsed, `Catalog request took ${elapsed.toFixed(0)} ms`).toBeLessThan(maxResponseTime);
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

  test('creates, reads, replaces, deletes a collection book and verifies its absence', async ({ request }) => {
    test.setTimeout(90000);
    const catalogResponse = await request.get('/BookStore/v1/Books');
    expect(catalogResponse.status()).toBe(userData.httpStatus.ok);
    const catalog = catalogSchema.parse(await catalogResponse.json());
    const isbns = [...new Set(catalog.books.map(book => book.isbn))];
    expect(isbns.length, 'Replacement requires two different catalog books').toBeGreaterThanOrEqual(2);
    const [originalIsbn, replacementIsbn] = isbns;
    const user = await createUser(request);

    try {
      await login(request, user);
      const headers = { Authorization: `Bearer ${user.token}` };
      const profilePath = `/Account/v1/User/${user.userID}`;

      await test.step('Create a book in the user collection', async () => {
        const response = await request.post('/BookStore/v1/Books', {
          headers,
          data: { userId: user.userID, collectionOfIsbns: [{ isbn: originalIsbn }] },
        });
        expect(response.status()).toBe(userData.httpStatus.created);
      });

      await test.step('Read the persisted collection', async () => {
        const response = await request.get(profilePath, { headers });
        expect(response.status()).toBe(userData.httpStatus.ok);
        const profile = userProfileSchema.parse(await response.json());
        expect(profile.books.map(book => book.isbn)).toEqual([originalIsbn]);
      });

      await test.step('Update with PUT and verify persistence', async () => {
        const response = await request.put(`/BookStore/v1/Books/${encodeURIComponent(originalIsbn)}`, {
          headers,
          data: { userId: user.userID, isbn: replacementIsbn },
        });
        expect(response.status()).toBe(userData.httpStatus.ok);
        const readResponse = await request.get(profilePath, { headers });
        expect(readResponse.status()).toBe(userData.httpStatus.ok);
        const profile = userProfileSchema.parse(await readResponse.json());
        expect(profile.books.map(book => book.isbn)).toEqual([replacementIsbn]);
        expect(profile.books.some(book => book.isbn === originalIsbn)).toBe(false);
      });

      await test.step('Delete the replacement book', async () => {
        const response = await request.delete('/BookStore/v1/Book', {
          headers,
          data: { userId: user.userID, isbn: replacementIsbn },
        });
        expect(response.status()).toBe(userData.httpStatus.noContent);
        expect(await response.text()).toBe(userData.responses.emptyBody);
      });

      await test.step('Verify absence while the user still exists', async () => {
        const response = await request.get(profilePath, { headers });
        expect(response.status()).toBe(userData.httpStatus.ok);
        const profile = userProfileSchema.parse(await response.json());
        expect(profile.userId).toBe(user.userID);
        expect(profile.books).toEqual([]);
      });
    } finally {
      await cleanupUser(request, user);
    }
  });
});