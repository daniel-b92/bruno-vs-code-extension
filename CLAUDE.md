# Conventions

@CONVENTIONS.md

# Further guidelines

- For the setup, the project structure and the scripts for running the extension and tests, see `CONTRIBUTING.md`.
- Before adding dependencies, using restricted modules or APIs (e.g. for spawning processes or network access) or changing files that are checked by the security checks (e.g. allowlists in `.github/scripts/` or `eslint.config.ts`), read the section "Security checks" in `CONTRIBUTING.md`.

# Changelog

- After finishing a change (and when reviewing a branch), check whether `CHANGELOG.md` needs an entry according to the changelog conventions above, and if so, add it under `## [Unreleased]` without being asked. Mention in the reply that the changelog was updated (or why no entry was needed).
- Whenever you modify `CHANGELOG.md` (adding or extending entries, resolving merge conflicts, ...), also review all entries under `## [Unreleased]` and keep them concise: focus each entry on the main user-facing point of the change and leave out details like exhaustive lists of affected APIs, keys, actions or edge cases (one or two examples are enough). Prefer a single bullet per change, and use sub-bullets only for genuinely separate aspects of a larger feature. Don't touch entries of released versions.
