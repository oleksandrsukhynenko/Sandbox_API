import { test } from '@playwright/test';
import { ApiClient } from '../clients/api.client';
import { endpoints } from '../data/endpoints';
import type { ApiError, FailedTokenResponse, RegisteredUser, TokenResponse, UserCredentials, UserProfile } from '../models/api.models';

export class AccountService {
  constructor(private readonly client: ApiClient) {}

  /** Registers an account; partial or malformed payloads are supported for negative tests. */
  create(credentials: Partial<UserCredentials> | Record<string, unknown>) {
    return test.step('Account: register a user', () =>
      this.client.send<RegisteredUser | ApiError>(endpoints.account.user, 'POST', { data: credentials }));
  }

  /** Generates a token without treating rejected credentials as a transport failure. */
  generateToken(credentials: Partial<UserCredentials>) {
    return test.step('Account: generate a token', () =>
      this.client.send<TokenResponse | FailedTokenResponse | ApiError>(endpoints.account.generateToken, 'POST', { data: credentials }));
  }

  /** Checks whether the supplied credentials have been authorized. */
  authorized(credentials: Partial<UserCredentials>) {
    return test.step('Account: check authorization', () =>
      this.client.send<boolean | ApiError>(endpoints.account.authorized, 'POST', { data: credentials }));
  }

  /** Reads a profile, optionally using bearer authorization. */
  getById(userId: string, token?: string) {
    return test.step('Account: read a user profile', () =>
      this.client.send<UserProfile | ApiError>(endpoints.account.userById(userId), 'GET', {}, token));
  }

  /** Deletes an account; successful responses have no JSON body. */
  delete(userId: string, token?: string) {
    return test.step('Account: delete a user', () =>
      this.client.send<ApiError | undefined>(endpoints.account.userById(userId), 'DELETE', {}, token));
  }

  /** Deletes an owned test account through Basic auth when no bearer token is available. */
  deleteWithCredentials(userId: string, credentials: UserCredentials) {
    const authorization = Buffer.from(`${credentials.userName}:${credentials.password}`).toString('base64');
    return test.step('Account: delete a user with credential-based authorization', () =>
      this.client.send<ApiError | undefined>(endpoints.account.userById(userId), 'DELETE', {
        headers: { Authorization: `Basic ${authorization}` },
      }));
  }
}