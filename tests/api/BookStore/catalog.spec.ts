import { test, expect } from '../fixtures/api.fixture';
import { buildCatalogLookupCases, catalogLookupCaseNames } from '../data/books.data';
import { bookSchema, catalogSchema, errorSchema } from '../helpers/schemas';
//remove comment
/** Checks ISBN lookup boundaries, encoding and whitespace behavior using a real catalog book. */
test.describe('Catalog ISBN lookup', { tag: '@regression' }, () => {
  for (const name of catalogLookupCaseNames) {
    test(`lookup: ${name}`, {
      //different annotations if the tests
      annotation: {
        type: 'description',
        description: `Checks "${name}" against a real catalog ISBN, verifying the HTTP status and the book or error response contract.`,
      },
    }, async ({ catalog }) => {
      const catalogResponse = await test.step('Request the public book catalog', async () => {
        return catalog.getAll();
      });

      const isbn = await test.step('Validate the catalog and select a real 13-digit ISBN', async () => {
        const response = catalogResponse;
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

      const response = await test.step(`Request a book for "${name}"`, async () => {
        return catalog.getByIsbn(data.isbn);
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