import { z } from 'zod';

export const bookSchema = z.object({
  isbn: z.string().min(1),
  title: z.string().min(1),
  subTitle: z.string(),
  author: z.string().min(1),
  publish_date: z.iso.datetime(),
  publisher: z.string().min(1),
  pages: z.number().int().positive(),
  description: z.string(),
  website: z.url(),
});

export const userProfileSchema = z.object({
  userId: z.uuid(),
  username: z.string().min(1),
  books: z.array(bookSchema),
});

export const tokenSchema = z.strictObject({
  token: z.string().min(1),
  expires: z.iso.datetime(),
  status: z.literal('Success'),
  result: z.literal('User authorized successfully.'),
});

export const failedTokenSchema = z.strictObject({
  token: z.null(),
  expires: z.null(),
  status: z.literal('Failed'),
  result: z.string().min(1),
});

export const registrationSchema = z.strictObject({
  userID: z.uuid(),
  username: z.string().min(1),
  books: z.array(bookSchema),
});

export const catalogSchema = z.object({ books: z.array(bookSchema).min(1) });

export const collectionSchema = z.strictObject({
  books: z.array(z.strictObject({ isbn: z.string().min(1) })),
});

export const errorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
});