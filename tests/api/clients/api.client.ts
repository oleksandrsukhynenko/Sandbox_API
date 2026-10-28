import type { APIRequestContext, APIResponse } from '@playwright/test';

export interface TypedApiResponse<Body> extends APIResponse {
  json(): Promise<Body>;
}

type RequestOptions = NonNullable<Parameters<APIRequestContext['fetch']>[1]>;

export class ApiClient {
  constructor(private readonly request: APIRequestContext) {}
//add descriptions of the parameters
  /** Sends a request using the context base URL; keeps error responses available to tests.
   * @param path - The relative path to the API endpoint.
   * @param method - The HTTP method to use for the request.
   * @param options - Optional request options, such as headers and body.
   * @param token - The authorization token for the request.
   */
  async send<Body>(path: string, method: string, options: RequestOptions = {}, token?: string): Promise<TypedApiResponse<Body>> {
    try {
      return await this.request.fetch(path, {
        ...options,
        method,
        failOnStatusCode: false,
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...options.headers,
        },
      }) as TypedApiResponse<Body>;
    } catch (error) {
      throw new Error(`${method} ${path} failed before an HTTP response was received`, { cause: error });
    }
  }
}