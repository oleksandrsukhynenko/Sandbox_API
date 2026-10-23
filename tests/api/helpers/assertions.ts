import { expect, type APIRequestContext } from '@playwright/test';

/**
 * Reads a resource by URL-encoded ID and verifies a 2xx response and partial JSON match.
 * @param request - Playwright API context configured with the API base URL.
 * @param endpoint - Collection path without the resource ID.
 * @param id - Resource identifier appended to the endpoint.
 * @param expectedBody - Fields that must match the returned JSON object.
 * @param options - Optional request headers, such as bearer authorization.
 * @returns The parsed JSON response body.
 */
export async function verifyObjectCreated(
  request: APIRequestContext,
  endpoint: string,
  id: string | number,
  expectedBody: Record<string, unknown>,
  options: { headers?: Record<string, string> } = {},
) {
  const path = `${endpoint.replace(/\/$/, '')}/${encodeURIComponent(String(id))}`;
  const response = await request.get(path, options);
  await expect(response, 'Created object must be accessible by ID').toBeOK();
  const body = await response.json();
  expect(body).toMatchObject(expectedBody);
  return body;
}

/**
 * Reads a resource by URL-encoded ID and verifies the expected absence response.
 * @param request - Playwright API context configured with the API base URL.
 * @param endpoint - Collection path without the resource ID.
 * @param id - Identifier of the deleted resource.
 * @param options - Request headers, expected status (default 404) and optional JSON fields to match.
 * @returns The API response; JSON is parsed only when expectedBody is supplied.
 */
export async function verifyObjectDeleted(
  request: APIRequestContext,
  endpoint: string,
  id: string | number,
  options: {
    headers?: Record<string, string>;
    expectedStatus?: number;
    expectedBody?: Record<string, unknown>;
  } = {},
) {
  const path = `${endpoint.replace(/\/$/, '')}/${encodeURIComponent(String(id))}`;
  const response = await request.get(path, { headers: options.headers });
  expect(response.status(), 'Deleted object must not be accessible by ID').toBe(
    options.expectedStatus ?? 404,
  );
  if (options.expectedBody) {
    expect(await response.json()).toMatchObject(options.expectedBody);
  }
  return response;
}