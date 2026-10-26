import { test as base } from '@playwright/test';
import { ApiClient } from '../clients/api.client';
import { AccountService } from '../services/account.service';
import { CatalogService } from '../services/catalog.service';
import { CollectionService } from '../services/collection.service';
import { createUser, login, cleanupUser, type User } from '../helpers/user.helper';
import { createUserCredentials, type UserCredentials } from '../data/users.data';

interface ApiFixtures {
  accounts: AccountService;
  catalog: CatalogService;
  collection: CollectionService;
  user: User;
  authenticatedUser: User;
  otherUser: User;
  userCredentials: UserCredentials;
}

export const test = base.extend<ApiFixtures>({
  accounts: async ({ request }, use) => {
    await use(new AccountService(new ApiClient(request)));
  },
  catalog: async ({ request }, use) => {
    await use(new CatalogService(new ApiClient(request)));
  },
  collection: async ({ request }, use) => {
    await use(new CollectionService(new ApiClient(request)));
  },
  /** Supplies unique credentials; individual suites can override special input values. */
  userCredentials: async ({}, use) => {
    await use(createUserCredentials());
  },
  /** Creates a registered user and removes it after all dependent fixtures finish. */
  user: async ({ accounts, userCredentials }, use) => {
    const user = await base.step('Create a test user', () => createUser(accounts, userCredentials));
    await use(user);
    await base.step('Clean up the test user', () => cleanupUser(accounts, user));
  },
  /** Authorizes the managed user; the user fixture remains responsible for cleanup. */
  authenticatedUser: async ({ accounts, user }, use) => {
    await base.step('Generate an authentication token', () => login(accounts, user));
    await use(user);
  },
  /** Creates an independent second user for ownership tests and cleans it up afterwards. */
  otherUser: async ({ accounts }, use) => {
    const user = await base.step('Create another test user', () => createUser(accounts));
    await use(user);
    await base.step('Clean up the other test user', () => cleanupUser(accounts, user));
  },
});

export { expect } from '@playwright/test';