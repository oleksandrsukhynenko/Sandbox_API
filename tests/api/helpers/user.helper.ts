import { expect, type APIRequestContext } from '@playwright/test';
import { createUserCredentials, userData, type UserCredentials } from '../data/users.data';
import { endpoints } from '../data/endpoints';

export type User = {
  credentials: UserCredentials;
  userID: string;
  registration: { userID: string; username: string; books: unknown[] };
  token?: string;
  deleted: boolean;
};

/**
 * Creates a user through POST /Account/v1/User and verifies HTTP 201.
 * @param request - Playwright API context configured with the API base URL.
 * @param credentials - Login details; unique credentials are generated when omitted.
 * @returns User credentials, ID and registration response, with deleted set to false.
 */
export async function createUser(
  request: APIRequestContext,
  credentials: UserCredentials = createUserCredentials(),
): Promise<User> {
  const response = await request.post(endpoints.account.user, { data: credentials });
  expect(response.status()).toBe(userData.httpStatus.created);
  const registration = await response.json();
  return {
    credentials,
    userID: registration.userID,
    registration,
    deleted: false,
  };
}

/**
 * Generates a token and verifies a successful response with a future expiration.
 * @param request - Playwright API context configured with the API base URL.
 * @param user - Registered user; the returned nonempty token is stored in user.token.
 * @returns Parsed token response, including token, expires, status and result.
 */
export async function login(request: APIRequestContext, user: User) {
  const response = await request.post(endpoints.account.generateToken, {
    data: user.credentials,
  });
  expect(response.status()).toBe(userData.httpStatus.ok);
  const body = await response.json();
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
 * @param request - Playwright API context configured with the API base URL.
 * @param user - User to delete; its token and deleted flag may be updated.
 * @returns The deletion API response.
 */
export async function deleteUser(request: APIRequestContext, user: User) {
  if (!user.token) {
    await login(request, user);
  }
  const response = await request.delete(endpoints.account.userById(user.userID), {
    headers: { Authorization: `Bearer ${user.token}` },
  });
  if (response.status() === userData.httpStatus.noContent) {
    user.deleted = true;
  }
  expect(response.status(), 'User deletion must succeed').toBe(userData.httpStatus.noContent);
  return response;
}

/**
 * Deletes a test user unless user.deleted already indicates successful deletion.
 * Authentication and deletion errors propagate rather than being silently ignored.
 * @param request - Playwright API context configured with the API base URL.
 * @param user - User to clean up through deleteUser.
 * @returns Resolves without a value after cleanup or when deletion is already recorded.
 */
export async function cleanupUser(request: APIRequestContext, user: User) {
  if (!user.deleted) {
    await deleteUser(request, user);
  }
}