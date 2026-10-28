import { expect } from '@playwright/test';
import { createUserCredentials, userData, type UserCredentials } from '../data/users.data';
import type { AccountService } from '../services/account.service';
import type { RegisteredUser } from '../models/api.models';
import { registrationSchema, tokenSchema } from './schemas';

export type User = {
  credentials: UserCredentials;
  userID: string;
  registration: RegisteredUser;
  token?: string;
  deleted: boolean;
};

/**
 * Creates a user through POST /Account/v1/User and verifies HTTP 201.
 * @param accounts - Account service configured through the shared API fixture.
 * @param credentials - Login details; unique credentials are generated when omitted.
 * @returns User credentials, ID and registration response, with deleted set to false.
 */
export async function createUser(
  accounts: AccountService,
  credentials: UserCredentials = createUserCredentials(),
): Promise<User> {
  const response = await accounts.create(credentials);
  expect(response.status()).toBe(userData.httpStatus.created);
  const registration = registrationSchema.parse(await response.json());
  return {
    credentials,
    userID: registration.userID,
    registration,
    deleted: false,
  };
}

/**
 * Generates a token and verifies a successful response with a future expiration.
 * @param accounts - Account service configured through the shared API fixture.
 * @param user - Registered user; the returned nonempty token is stored in user.token.
 * @returns Parsed token response, including token, expires, status and result.
 */
export async function login(accounts: AccountService, user: User) {
  const response = await accounts.generateToken(user.credentials);
  expect(response.status()).toBe(userData.httpStatus.ok);
  const body = tokenSchema.parse(await response.json());
  if (typeof body.token === 'string' && body.token.length > 0) {
    user.token = body.token;
  }
  expect(body).toMatchObject(userData.responses.loginSuccess);
  expect(user.token).toEqual(expect.any(String));
  expect(Date.parse(body.expires)).toBeGreaterThan(Date.now());
  return body;
}

/**
 * Deletes a user with bearer authorization and verifies HTTP 204.
 * Generates a token if user.token is missing; marks user.deleted on HTTP 204.
 * @param accounts - Account service configured through the shared API fixture.
 * @param user - User to delete; its token and deleted flag may be updated.
 * @returns The deletion API response.
 */
export async function deleteUser(accounts: AccountService, user: User) {
  if (!user.token) {
    await login(accounts, user);
  }
  const response = await accounts.delete(user.userID, user.token);
  if (response.status() === userData.httpStatus.noContent) {
    user.deleted = true;
  }
  expect(response.status(), 'User deletion must succeed').toBe(userData.httpStatus.noContent);
  return response;
}

/**
 * Deletes a test user unless user.deleted already indicates successful deletion.
 * Uses Basic auth when no token exists so cleanup does not depend on token generation.
 * Authentication and deletion errors propagate rather than being silently ignored.
 * @param accounts - Account service configured through the shared API fixture.
 * @param user - User to clean up through deleteUser.
 * @returns Resolves without a value after cleanup or when deletion is already recorded.
 */
export async function cleanupUser(accounts: AccountService, user: User) {
  if (user.deleted) {
    return;
  }
  if (user.token) {
    await deleteUser(accounts, user);
  } else {
    const response = await accounts.deleteWithCredentials(user.userID, user.credentials);
    if (response.status() === userData.httpStatus.noContent) {
      user.deleted = true;
    }
    expect(response.status(), 'Credential-based user cleanup must succeed').toBe(userData.httpStatus.noContent);
  }
}