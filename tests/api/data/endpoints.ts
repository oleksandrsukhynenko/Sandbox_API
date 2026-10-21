const accountBase = '/Account/v1';
const bookStoreBase = '/BookStore/v1';

export const endpoints = {
  account: {
    authorized: `${accountBase}/Authorized`,
    generateToken: `${accountBase}/GenerateToken`,
    user: `${accountBase}/User`,
    userById: (userID: string) => `${accountBase}/User/${encodeURIComponent(userID)}`,
  },
  bookStore: {
    books: `${bookStoreBase}/Books`,
    book: `${bookStoreBase}/Book`,
    //booksByIsbn: (isbn: string) => `${bookStoreBase}/${books}/${encodeURIComponent(isbn)}`,
    booksByIsbn: (isbn: string) => `${bookStoreBase}/Books/${encodeURIComponent(isbn)}`,
  },
} as const;