import { test } from '@playwright/test';
import { ApiClient } from '../clients/api.client';
import { endpoints } from '../data/endpoints';
import type { AddBooksRequest, ApiError, CollectionBookRequest, CollectionResponse, UserProfile } from '../models/api.models';

export class CollectionService {
  constructor(private readonly client: ApiClient) {}

  /** Adds catalog ISBNs to a user collection; accepts missing fields for validation tests. */
  add(data: Partial<AddBooksRequest>, token?: string) {
    return test.step('Collection: add books', () =>
      this.client.send<CollectionResponse | ApiError>(endpoints.bookStore.books, 'POST', { data }, token));
  }

  /** Replaces an owned ISBN with another catalog book. */
  replace(isbn: string, data: CollectionBookRequest, token?: string) {
    return test.step('Collection: replace a book', () =>
      this.client.send<UserProfile | ApiError>(endpoints.bookStore.booksByIsbn(isbn), 'PUT', { data }, token));
  }

  /** Removes one ISBN; successful responses have no JSON body. */
  delete(data: CollectionBookRequest, token?: string) {
    return test.step('Collection: delete a book', () =>
      this.client.send<ApiError | undefined>(endpoints.bookStore.book, 'DELETE', { data }, token));
  }
}