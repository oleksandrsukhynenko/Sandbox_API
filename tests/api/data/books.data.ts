export interface CatalogLookupCase {
  name: string;
  isbn: string;
  expectedStatus: number;
  found: boolean;
}
//parrameters
/** Builds exact-lookup cases around a real catalog ISBN rather than a hardcoded title. */
export function buildCatalogLookupCases(isbn: string): CatalogLookupCase[] {
  return [
    { name: 'existing ISBN', isbn, expectedStatus: 200, found: true },
    { name: 'empty ISBN', isbn: '', expectedStatus: 400, found: false },
    { name: 'one-character ISBN', isbn: '1', expectedStatus: 400, found: false },
    { name: '12-character ISBN', isbn: isbn.slice(0, -1), expectedStatus: 400, found: false },
    { name: '14-character ISBN', isbn: `${isbn}0`, expectedStatus: 400, found: false },
    { name: 'unknown 13-digit ISBN', isbn: '0000000000000', expectedStatus: 400, found: false },
    { name: 'nonnumeric ISBN', isbn: 'ABCDEFGHIJKLM', expectedStatus: 400, found: false },
    { name: 'leading whitespace', isbn: ` ${isbn}`, expectedStatus: 400, found: false },
    { name: 'trailing whitespace is normalized', isbn: `${isbn} `, expectedStatus: 200, found: true },
    { name: 'URL-sensitive characters', isbn: '+&?%#', expectedStatus: 400, found: false },
  ];
}

export const catalogLookupCaseNames = buildCatalogLookupCases('0000000000001').map(({ name }) => name);

export const unknownIsbn = '0000000000000';