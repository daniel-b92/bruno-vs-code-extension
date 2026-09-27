# Testing conventions

- Test code should be kept as clean as production code — avoid duplicating test setup/helper logic across test files.
- Before writing a test helper (mock builders, fixture factories, etc.), check whether one already exists that can be reused or extended, rather than adding a local copy in the new test file.
- Shared test utilities live in `shared/_testingUtils/` (re-exported from `shared/_testingUtils/index.ts`):
    - `shared` package tests import them with a relative path, e.g. `import { createCollectionWithEnvironments } from "../_testingUtils";`.
    - `server` (and other packages with the `@global_shared` alias) import them via `@global_shared/_testingUtils` — this works because of the wildcard path mapping (`@global_shared/*` → `shared/*`) already configured in `tsconfig.json` and `jest.config.js`, without needing the helper exported from the main `shared/index.ts` (which is reserved for production code).
- When a helper used in one test would also be useful in another (even in a different package), extract it into `shared/_testingUtils/` instead of copy-pasting it.
