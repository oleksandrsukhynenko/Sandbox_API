import { randomUUID } from 'node:crypto';

export type UserCredentials = { userName: string; password: string };

export function createUserCredentials(): UserCredentials {
  return {
    userName: `api_${randomUUID()}`,
    password: `Api!9aA${randomUUID()}`,
  };
}

export const userData = {
  invalidPassword: 'Wrong!Password123',
  invalidToken: 'invalid-token',
  missingCredentialsCases: [
    { name: 'missing username', credentials: { password: 'Api!9aA123' } },
    { name: 'missing password', credentials: { userName: 'api_invalid' } },
    { name: 'empty username', credentials: { userName: '', password: 'Api!9aA123' } },
    { name: 'empty password', credentials: { userName: 'api_invalid', password: '' } },
  ],
  weakPasswordCases: [
    { name: 'too short', password: 'Aa!1' },
    { name: 'without uppercase letters', password: 'password!123' },
    { name: 'without digits', password: 'Password!abc' },
    { name: 'without special characters', password: 'Password123' },
  ],
  uuidPattern: /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i,
  httpStatus: {
    ok: 200,
    created: 201,
    noContent: 204,
    badRequest: 400,
    unauthorized: 401,
    notFound: 404,
    duplicateUser: 406,
  },
  responses: {
    loginSuccess: { status: 'Success', result: 'User authorized successfully.' },
    loginFailure: { token: null, status: 'Failed' },
    invalidCredentials: { code: '1200' },
    weakPassword: { code: '1300' },
    duplicateUser: { code: '1204' },
    userNotFound: { code: '1207' },
    emptyBooks: [] as unknown[],
    emptyBody: '',
    authorized: true,
    notAuthorized: false,
  },
};