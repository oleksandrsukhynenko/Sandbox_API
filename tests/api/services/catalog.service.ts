import { test } from '@playwright/test';
import { ApiClient } from '../clients/api.client';
import { endpoints } from '../data/endpoints';
import type { ApiError, Book, Catalog } from '../models/api.models';

export class CatalogService {
  constructor(private readonly client: ApiClient) {}

  /** Reads the public book catalog. */
  getAll() {
    return test.step('Catalog: read all books', () =>
      this.client.send<Catalog>(endpoints.bookStore.books, 'GET'));
  }

  /** Finds a catalog book by its ISBN query parameter. */
  getByIsbn(isbn: string) {
    return test.step('Catalog: find a book by ISBN', () =>
      this.client.send<Book | ApiError>(endpoints.bookStore.book, 'GET', { params: { ISBN: isbn } }));
  }
}