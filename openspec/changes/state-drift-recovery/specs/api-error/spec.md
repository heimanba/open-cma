## ADDED Requirements

### Requirement: ApiError class with statusCode
BaseApiClient SHALL throw `ApiError` (extends `Error`) instead of plain `Error` for all non-ok HTTP responses. `ApiError` MUST expose `statusCode: number` and `responseBody: string` as public readonly properties.

#### Scenario: POST returns 409
- **WHEN** `BaseApiClient.post()` receives a 409 response
- **THEN** it throws `ApiError` with `statusCode === 409` and `responseBody` containing the response text

#### Scenario: GET returns 404
- **WHEN** `BaseApiClient.get()` receives a 404 response
- **THEN** it throws `ApiError` with `statusCode === 404`

#### Scenario: Error message format unchanged
- **WHEN** any HTTP method throws `ApiError`
- **THEN** `error.message` SHALL match the format `"<prefix> <statusCode>: <responseBody>"` (backward compatible with existing log output)

### Requirement: ApiError applies to all HTTP methods
All HTTP methods in BaseApiClient (`get`, `post`, `put`, `delete`) and `QoderClient.postFormData` SHALL throw `ApiError` instead of plain `Error`.

#### Scenario: postFormData returns 400
- **WHEN** `QoderClient.postFormData()` receives a 400 response
- **THEN** it throws `ApiError` with `statusCode === 400`

### Requirement: ApiError is instanceof Error
`ApiError` SHALL extend `Error` so that existing `catch (err) { err instanceof Error }` checks continue to work.

#### Scenario: Backward compatible catch
- **WHEN** code catches `ApiError` with `err instanceof Error`
- **THEN** the check returns `true`

### Requirement: Existing 409 string matching migrated
`QoderAdapter.deleteEnvironment` SHALL use `err instanceof ApiError && err.statusCode === 409` instead of `msg.includes("409")` to detect conflict errors.

#### Scenario: deleteEnvironment conflict detection
- **WHEN** `deleteEnvironment` receives a 409 response because the environment is in use
- **THEN** it catches `ApiError` with `statusCode === 409` and proceeds with session cleanup logic
