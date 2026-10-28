# DemoQA API tests

Playwright + TypeScript + Zod tests for accounts, the public book catalog and user book collections.

## Run locally

Requires Node.js LTS and network access to DemoQA. API-only tests do not require browser binaries.

```sh
npm ci
npm run typecheck
npm test
npm run test:smoke
npm run test:regression
npm run test:known-issues
npm run test:report
```

`BASE_URL` overrides the default `https://demoqa.com`. `API_MAX_RESPONSE_TIME_MS` overrides the existing catalog response-time budget (10000 ms). These are overrides, not evidence of two independently deployed environments.

Local runs use two workers; CI uses one. This limits load on the shared DemoQA service without increasing test timeouts or adding request retries.

## Layers

```text
tests/api/
  clients/api.client.ts       HTTP transport and bearer headers
  services/                  AccountService, CatalogService, CollectionService
  models/api.models.ts       Request interfaces and schema-inferred response types
  fixtures/api.fixture.ts    Test-scoped services and managed user lifecycle
  data/                      Endpoints, credential factory, lookup datasets
  helpers/                   Lifecycle assertions, response schemas, raw HTTP exception
  Accounts/                  Account scenarios and credential boundaries
  BookStore/                 Catalog, CRUD flow and collection business rules
tests/contracts/              Offline schema and factory checks
tests/reporters/              Explicit per-project outcome summary
```

The normal path is test -> service -> ApiClient -> Playwright request context. The context owns base URL, request lifetime and Playwright reporting. ApiClient supplies common headers, optional bearer auth and transport-error context. It preserves HTTP error responses for negative tests, does not eagerly parse JSON (204 and HTML remain valid transport responses), and does not retry mutations.

Services describe resource operations and add `test.step` entries. They do not choose expected statuses or assert business behavior. Lifecycle helpers deliberately assert successful setup and cleanup; they are called by fixtures rather than repeated lifecycle hooks in the standard account and collection tests. Existing setup for public catalog and malformed-credentials tests is retained through explicitly requested user fixtures.

### User fixtures

- `userCredentials` supplies unique defaults and can be overridden for a specific suite, as in the special-character username test.
- `user` creates an account without generating a token and owns cleanup after the test and all dependent fixtures finish.
- `authenticatedUser` depends on `user`, generates a token and exposes the same user object. This keeps pre-authorization tests independent from authenticated setup.
- `otherUser` creates an independent second account for ownership checks and owns its cleanup. It does not reuse `userCredentials` from the first account.
- The collection suite adds a local `catalogIsbns` fixture for selecting real ISBNs. It has no user lifecycle hooks or `try/finally` blocks.

```ts
test('reads a profile', async ({ accounts, authenticatedUser: user }) => {
  const response = await accounts.getById(user.userID, user.token);
  expect(response.status()).toBe(200);
});
```

Fixtures are lazy and test-scoped. The helper describes how to create/delete an account; the fixture owns when to do it. A successfully deleted user is marked `deleted` so teardown does not delete it twice. Cleanup uses the bearer token when available; otherwise it uses verified Basic auth with the same account's credentials, without depending on GenerateToken. Cleanup errors remain assertions, not silently ignored responses. Boundary-registration tests retain their explicit hooks because creation is the operation under test.

`sendRawCredentials` is the explicit exception: Node HTTP can omit Content-Type entirely, which the normal Playwright JSON path automatically supplies. Do not use it for ordinary endpoint tests.

### Add an endpoint

1. Add its path to the endpoint map and request/response types to the model module. Define a response schema when the contract matters.
2. Add a documented method to the owning service, wrapping its client call in a descriptive step. Reuse an existing service unless this is a genuinely different resource.
3. Import `test` and `expect` from the API fixture. Add a named scenario using the service, response schema, expected status and persisted-state assertions where appropriate.
4. Tag the describe block `@regression`; mark a small critical subset `@smoke`. Mark reproduced API defects and current-defect characterizations `@known-issue` with an issue annotation. Use one describe per file and case names in parameterized titles.

The credential factory accepts partial overrides while generating unique defaults:

```ts
const credentials = createUserCredentials({ password: 'Aa!12345' });
```

### Tradeoffs

- Three small composed services were chosen over inheritance, a generic CRUD service or a dependency-injection framework. Catalog reads and authenticated collection mutations share URLs but not responsibilities.
- Service fixtures centralize wiring; `user`/`authenticatedUser`/`otherUser` fixtures now own repeated lifecycle work. Helpers remain their implementation details. Registration-boundary cases keep creation visible in the test and cleanup in `afterEach`.
- Response types are inferred from Zod to avoid maintaining two descriptions of the same body. Typed service responses include error variants; TypeScript alone does not validate network JSON.
- Explicit `200`/`400` expectations and resource-specific methods remain readable. Do not hide endpoint rules behind a generic helper with many flags.

## Coverage and contracts

See [coverage analysis](docs/coverage-analysis.md) for scenario priorities, boundary choices, known defects and unsupported requirements.

Registration, successful/failed token and collection-add responses use closed schemas: removed, renamed, mistyped or unexpected fields fail validation. Catalog books and profiles validate required fields and types but tolerate additive fields; their parsed results discard unknown keys. This is intentional forward compatibility, not a complete unknown-field detector. Error schemas validate individual negative responses; a cross-endpoint error-consistency suite is out of scope.

### Review an intended schema change

1. Reproduce the changed response without recording real tokens or passwords in Git. Check an authoritative API change description when available; observed behavior alone is not approval.
2. Decide whether the change is compatible with consumers, including whether extra fields should be allowed. Keep closed schemas closed unless the compatibility policy is intentionally changed.
3. Update schema, inferred models, affected expectations and offline schema checks together. Explain the reason and consumer impact in the PR.
4. Run focused tests and smoke/regression checks. Never loosen a schema just to make a failing pipeline green.

Offline contract checks demonstrate rejection of removed, renamed, mistyped and extra token fields, plus unexpected registration/collection fields. Live tests validate actual responses. No token snapshots are stored.

## CI strategy

- PRs to main/master run `@smoke` in the `api` project: registration/read, token, catalog and collection CRUD.
- Pushes to main/master run `@regression` in `api`, which includes smoke and offline contract checks but excludes known issues.
- Manual workflow runs select smoke or regression. Existing HTML report publication remains unchanged.
- Existing CI retries/workers are retained. Retried tests are not proof of stability, and catalog timing on a public service is a functional budget, not a load test.

CI typecheck, extra diagnostic artifacts, explicit CI secret/config wiring, a second environment and pipeline-failure analysis were intentionally not added. There is no new UI suite, cross-endpoint error-consistency suite or three-run stability claim.

### Known issues are separate

`npm test`, `test:smoke` and `test:regression` select the `api` project, which excludes `@known-issue`. `npm run test:known-issues` selects the separate `known-issues` project. Running `npx playwright test` without a project runs both, grouped by project in the HTML report. The same test is never selected by both projects.

The custom outcome summary reports passed checks, expected failures, skipped, flaky and unexpected failures separately for each project. Playwright's built-in headline includes expected failures in its "passed" count; use the explicit outcome summary when quoting results. Passing a known-issue characterization means the observed defect was reproduced, not that the API is correct.

- KNOWN-001: missing collectionOfIsbns produces 500 instead of a validation response; tracked as an expected failure only when the 500 occurs.
- KNOWN-002: mixed ISBN batches echo invalid items but only valid books appear in the profile; two characterization cases cover both orders.
- KNOWN-003: GenerateToken still returns 500 for a registered username containing `+&?%#`. The former fixme now executes, tracks that specific 500 as an expected failure and deletes its account through Basic auth. The server bug is not fixed by this repository.
- KNOWN-004: missing/incorrect Content-Type produces an HTML 500 response; two characterization cases document it.

There are no unconditional fixme skips for these cases. If the APIs start returning the correct responses for KNOWN-001/003, their contract assertions run normally; review and remove the known-issue tag after confirming the fix. Changed characterization behavior fails its known-issue test and requires investigation rather than automatic acceptance.

## QA review workflow

Run the workspace `/api-review` prompt to request an evidence-based, read-only review of a selected test or change. It asks for file references, separates confirmed defects from hypotheses, and respects this project's exclusions.

During this implementation, an initial atomic-batch hypothesis was rejected by live checks: mixed ISBN batches return 201, echo both items and persist only the valid book in either order. The final characterization verifies the real persisted state and records the response inconsistency as KNOWN-002 rather than claiming atomicity. The helper-vs-service and user-fixture choices above document the architecture decisions. The prompt has been added for future use; no claim of a separately measured prompt-improvement experiment is made.