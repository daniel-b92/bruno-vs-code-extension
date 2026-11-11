# Conventions

These conventions apply to all changes in this repository. For the setup, the project structure and the checks that run for pull requests, see [CONTRIBUTING.md](./CONTRIBUTING.md).

## Changelog

If your change is noticeable for users of the published extension (e.g. new or changed diagnostics, completions, hovers, syntax highlighting, collection explorer or test explorer behavior, fixed bugs), add an entry to [CHANGELOG.md](./CHANGELOG.md) under `## [Unreleased]`. Refactorings, renames, test changes, tooling and documentation need no entry, and neither do changes that only take effect behind a feature toggle that can only be enabled in development mode.

- Write one bullet per change, starting with a verb (e.g. "Fix an issue that caused ...", "Add support for ...", "Show a warning ..."). Put file names, block names and similar in backticks.
- Put fixes and small improvements under `### Fixes / Maintenance` and larger new functionality under `### Features`.
- If there is already an entry in `[Unreleased]` for the same change, extend it instead of adding a second one.

## Tests

- Keep test code as clean as production code. Before writing a helper (mock builder, fixture factory, ...), check whether one already exists that you can reuse or extend.
- Shared test utilities live in `shared/_testingUtils/` (exported by its `index.ts`). If a helper would also be useful in another test, even in a different package, move it there instead of copying it. `shared` tests import it with a relative path (`../_testingUtils`), `server` tests via `@global_shared/_testingUtils`.
- Within a test file, put file-local helpers at the bottom, after the tests.
- Tests for parsing must define the parsed file content (e.g. Bru or Yaml documents) as a string inside the test. Don't read files from `samples/` or other fixture files on disk.
- Jest only transpiles the code and does not report type errors in tests. They are only caught by `npm run check-types`.

## Type checking

Use `npm run check-types`, not `tsc -p <project>` or `tsc --noEmit` for `client` or `server`. Both projects reference `shared` as a TypeScript project, so a direct call could use its possibly outdated build output from `shared/out` instead of its sources.

## Supporting both collection formats

- Code that handles both collection formats (Bru and Yaml) should not fall back to one of them (e.g. default parameter values like `format = CollectionFormat.Bru`). Require the format explicitly and handle the case where it cannot be determined, e.g. by returning early with an error.
- Parsing utilities that are specific to one format live in `shared/fileParsing/external/bruFormat/` or `shared/fileParsing/external/yamlFormat/`. Utilities that handle both formats (e.g. by dispatching on the file extension or the collection format) live in `shared/fileParsing/external/shared/`. If a utility in a format-specific folder starts supporting both formats, move it there.

## Syntax highlighting

The grammar for `.bru` files ([bru.tmLanguage.json](./syntaxes/bru.tmLanguage.json)) is maintained by hand. The grammars that highlight embedded content in `yaml` collection files (the `syntaxes/yaml-*.injection.json` files) are **generated**, so don't edit them directly:

1. Change the sources in [syntaxes/generation/](./syntaxes/generation).
2. Run `npm run generate-syntaxes` to regenerate the JSON files, and commit them together with your changes.

`npm run test-syntaxes` fails if a generated file is out of date or is not contributed in the `package.json`. If you add a grammar, register it in `generatedGrammars.ts` and contribute it in the `package.json`. If your change uses a new embedded language, declare it in the `package.json` as well.
