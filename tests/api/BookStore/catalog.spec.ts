import type { APIResponse } from '@playwright/test';
import { test, expect } from '../fixtures/api.fixture';
import { buildCatalogLookupCases, catalogLookupCaseNames } from '../data/books.data';
import { bookSchema, catalogSchema, errorSchema } from '../helpers/schemas';

test.describe('Catalog ISBN lookup', { tag: '@regression' }, () => {
  let response: APIResponse;

  for (const name of catalogLookupCaseNames) {
    test(`lookup: ${name} - verifies status and response body using a real catalog ISBN`, async ({ catalog }) => {
      await test.step('Request the public book catalog', async () => {
        response = await catalog.getAll();
      });

      const isbn = await test.step('Validate the catalog and select a real 13-digit ISBN', async () => {
        expect(response.status()).toBe(200);
        const body = catalogSchema.parse(await response.json());
        const book = body.books.find(book => /^\d{13}$/.test(book.isbn));
        expect(book, 'The lookup dataset requires a 13-digit catalog ISBN').toBeDefined();
        return book!.isbn;
      });

      const data = await test.step(`Prepare lookup data for "${name}"`, async () => {
        const selectedCase = buildCatalogLookupCases(isbn).find(data => data.name === name);
        expect(selectedCase, `Lookup dataset must contain "${name}"`).toBeDefined();
        return selectedCase!;
      });

      await test.step(`Request a book for "${name}"`, async () => {
        response = await catalog.getByIsbn(data.isbn);
      });

      await test.step(`Verify HTTP status ${data.expectedStatus}`, async () => {
        expect(response.status()).toBe(data.expectedStatus);
      });

      if (data.found) {
        await test.step('Validate the book schema and match the original catalog ISBN', async () => {
          expect(bookSchema.parse(await response.json()).isbn).toBe(isbn);
        });
      } else {
        await test.step('Validate the error schema and book-not-found code 1205', async () => {
          const error = errorSchema.parse(await response.json());
          expect(error.code).toBe('1205');
        });
      }
    });
  }
});