<!-- Comments like this one are hints for writing the pull request and are not shown. See CONTRIBUTING.md for details on the checks and conventions. -->

## Description

<!-- What does this change do, and why? Link the related issue, e.g. "Closes #123". -->

## Sensitive files

<!-- Only if the "Sensitive files" check fails (changes to package.json, lockfiles, config files, .github/, .vscode/, CLAUDE.md etc.) or if you extended an allowlist (install scripts, package aliases, hidden Unicode characters, restricted modules in eslint.config.ts): explain why the change is needed. Otherwise remove this section. -->

## Checklist

- [ ] `npm run lint`, `npm run check-types`, `npm run compile` and `npm run test` pass
- [ ] Tests were added or updated for the changed behavior (if applicable)
- [ ] `CHANGELOG.md` has an entry under `## [Unreleased]` for changes that are noticeable for users of the extension (if applicable)
- [ ] Generated files are up to date, e.g. via `npm run generate-syntaxes` (if applicable)
