import type { z } from 'zod';
import type { bookSchema, catalogSchema, collectionSchema, errorSchema, failedTokenSchema, registrationSchema, tokenSchema, userProfileSchema } from '../helpers/schemas';

export interface UserCredentials {
  userName: string;
  password: string;
}

export type Book = z.infer<typeof bookSchema>;
export type UserProfile = z.infer<typeof userProfileSchema>;
export type TokenResponse = z.infer<typeof tokenSchema>;
export type FailedTokenResponse = z.infer<typeof failedTokenSchema>;

export type RegisteredUser = z.infer<typeof registrationSchema>;
export type ApiError = z.infer<typeof errorSchema>;
export type Catalog = z.infer<typeof catalogSchema>;

export interface IsbnReference {
  isbn: string;
}

export interface AddBooksRequest {
  userId: string;
  collectionOfIsbns: IsbnReference[];
}

export type CollectionResponse = z.infer<typeof collectionSchema>;

export interface CollectionBookRequest {
  userId: string;
  isbn: string;
}