# Testing conventions

- Test code should be kept as clean as production code — avoid duplicating test setup/helper logic across test files.
- Within a test file, place internal utility functions (file-local helpers, fixture builders, etc.) after the actual tests, at the bottom of the file, so the tests are the first thing a reader sees.
- Before writing a test helper (mock builders, fixture factories, etc.), check whether one already exists that can be reused or extended, rather than adding a local copy in the new test file.
- Shared test utilities live in `shared/_testingUtils/` (re-exported from `shared/_testingUtils/index.ts`):
    - `shared` package tests import them with a relative path, e.g. `import { createCollectionWithEnvironments } from "../_testingUtils";`.
    - `server` (and other packages with the `@global_shared` alias) import them via `@global_shared/_testingUtils` — this works because of the wildcard path mapping (`@global_shared/*` → `shared/*`) already configured in `tsconfig.json` and `jest.config.js`, without needing the helper exported from the main `shared/index.ts` (which is reserved for production code).
- When a helper used in one test would also be useful in another (even in a different package), extract it into `shared/_testingUtils/` instead of copy-pasting it.
- Parsing tests must define the parsed file content (e.g. Yaml or Bru documents) explicitly as a string inside the test. Never read files from `samples/` (or other fixture files on disk) in tests.

# Collection formats

- For functions etc. that can handle both formats (Bru and Yaml), avoid fallbacks towards a certain format (e.g. default parameter values like `format = CollectionFormat.Bru` or `?? CollectionFormat.Bru`), if that is not too much effort. Prefer requiring the format explicitly and handling the case where it cannot be determined (e.g. by returning early with an error).

# Parsing utilities

- Parsing utilities that are specific to one file format live in that format's folder under `shared/fileParsing/external/` (`bruFormat/` or `yamlFormat/`).
- Parsing utilities that handle both formats (e.g. by dispatching on the file extension or the collection format) live in `shared/fileParsing/external/shared/`, not in a format-specific folder. When a utility in a format-specific folder starts supporting both formats, move it there.

# Changelog

- After finishing a change (and when reviewing a branch), check whether `CHANGELOG.md` needs an entry, and if so, add it under `## [Unreleased]` without being asked. Mention in the reply that the changelog was updated (or why no entry was needed).
- Only document changes in behavior that users of the published extension can notice (e.g. new or changed diagnostics, completions, hovers, syntax highlighting, collection explorer or test explorer behavior, fixed bugs). Refactorings, renames, test changes and changes to tooling or documentation need no entry.
- Only document behavior that is reachable in the published extension. Feature toggles (see `shared/featureToggles/featureToggles.ts`) are disabled there by default, since they can only be enabled in development mode via `client/src/getFeatureToggles.ts`. The exception is `yamlCollectionSupport`, which users can enable via the preview setting `bru-as-code.yamlCollectionSupport`, so changes affecting `yaml` collections do need an entry (mention that they only apply while the setting is enabled). Changes that only take effect while another toggle is enabled need no entry. Changes to shared code that also affect the `bru` format do need one.
- Follow the style of the existing entries: one bullet per change, starting with a verb (e.g. "Fix an issue that caused ...", "Add support for ...", "Show a warning ..."), with file names, block names and similar in backticks. Put fixes and small improvements under `### Fixes / Maintenance` and larger new functionality under `### Features`. Extend an existing entry in `[Unreleased]` instead of adding a second one for the same change.

# Type checking

- Type-check with `npm run check-types`. Don't use `tsc -p <project>` or `tsc --noEmit` for `client` or `server`: both reference `shared` as a TypeScript project and would read its possibly outdated build output from `shared/out` instead of its sources.
- Jest (ts-jest) only transpiles the files (`isolatedModules` in the root `tsconfig.json`) and does not report type errors, so tests are only type-checked by `npm run check-types`. It also covers the `tsPlugin` tests (via `tsPlugin/tsconfig.test.json`, since `tsPlugin/tsconfig.json` excludes them) and `syntaxes`.
