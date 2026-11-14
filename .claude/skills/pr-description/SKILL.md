---
name: pr-description
description: Draft the description of a pull request for the current branch in this repository, following `.github/pull_request_template.md`, ready to copy and paste into a pull request the user creates manually on GitHub. Fills in the description, the "Sensitive files" section (only when needed) and the checklist based on the actual changes and checks. Use this whenever the user wants to write, draft, prepare or update a PR description, pull request text or merge request summary for a branch, even if they don't mention the template.
---

# Pull request description

The user creates the pull request on GitHub by hand. Your job is to give them a description they can copy and paste without editing it. Don't write a title, and don't create or update the pull request yourself (no `gh pr create` or `gh pr edit`).

The description is read by the reviewer, who knows the repository but not the conversation in which the change was made. Write so that they understand what the change does and why, and what to look at carefully.

## Workflow

### 1. Collect the changes of the branch

Compare the branch with `main` (or the base branch the user names):

- `git log --format='%h %s%n%b' main..HEAD` for the commits and their messages
- `git diff --stat main...HEAD` and `git diff main...HEAD` for the changes themselves. Read the diff, not only the commit messages, which are often short or out of date.
- `git status --short` for uncommitted changes. If there are changes to tracked files that are not committed yet, and it is unclear whether they belong to the pull request, ask the user before including them. Untracked files that are unrelated to the change (e.g. local configuration) are ignored.

Also use what is known from the conversation, e.g. why the change was made or which alternatives were rejected.

Look for the related issue: a number in the branch name (e.g. `123-fix-hover`) or in the commit messages (`#123`), or one mentioned in the conversation. Don't guess a number.

If the branch has no commits and no changes compared to `main`, tell the user and stop.

### 2. Run the checks

The first checklist item states that `npm run lint`, `npm run check-types`, `npm run compile` and `npm run test` pass. Only tick it when you saw them pass, so run them unless the user says not to, or they already ran successfully in this conversation on the current state of the code:

```sh
npm run lint && npm run check-types && npm run compile && npm run test
```

They run on the working tree, so uncommitted changes are included. If they fail, leave the item unticked and tell the user what failed (outside the code block). Don't fix the failures as part of writing the description unless the user asks.

### 3. Check the changelog and generated files

- **Changelog**: decide whether the change needs an entry in `CHANGELOG.md` under `## [Unreleased]`, following the changelog conventions in `CONVENTIONS.md`. If it needs one and there is none in the diff, add it (as `CLAUDE.md` asks for when reviewing a branch) and tell the user that you did, so they can commit it. If the entry exists, check that it matches what the change actually does.
- **Generated files**: if the diff touches `syntaxes/generation/`, the generated `syntaxes/yaml-*.injection.json` files must be part of the diff as well. `npm run test` includes `npm run test-syntaxes`, which fails if they are out of date.

### 4. Check for sensitive files

Read the patterns in `SENSITIVE_FILE_PATTERNS` in `.github/workflows/sensitive-files.yml` and match them against the changed files (`git diff --name-only main...HEAD`, plus uncommitted files that belong to the pull request). Use the file as the single source of truth instead of a list of your own, since it changes over time.

Also check whether the diff extends one of the allowlists described in the "Security checks" section of `CONTRIBUTING.md`: install scripts (`.github/scripts/checkInstallScripts.mjs`), package aliases (`.github/scripts/checkLockfiles.mjs`), hidden Unicode characters (`.github/scripts/checkHiddenUnicode.mjs`) or restricted modules (`getAllowedSensitiveImportsConfig(...)` in `eslint.config.ts`).

If neither applies, the "Sensitive files" section is removed. Otherwise, explain for each file or group of files why the change is needed, e.g. "`package.json`, `package-lock.json`: removes the unused dependency `foo` from `tsPlugin/package.json`". The reason has to come from the diff, the commits or the conversation. If you can't tell why a sensitive file was changed, ask the user instead of making something up, using the AskUserQuestion tool if available.

### 5. Draft the description

Read `.github/pull_request_template.md` and use its structure. The template is the single source of truth for the sections, so drafted descriptions look the same as ones written by hand. Use its headings in their order. The HTML comments are hints for you: follow them, then remove them, together with sections that don't apply.

**Description section:**

- Start with what the change does and why, in one to three sentences. Then, if the change has several parts, list them as bullets, grouped by topic rather than by commit.
- Mention what the reviewer should know and can't easily see in the diff: decisions and their reasons, rejected alternatives, behavior that intentionally stays the same, known limitations or follow-up work.
- For a change that users of the extension notice, describe the behavior from their point of view (e.g. which diagnostic now shows up where), not only the code.
- If a related issue was found in step 1, add "Closes #123" (or "Relates to #123" if the pull request only covers part of it).
- Refer to code by paths in backticks (`server/src/...`), not markdown links, since relative links don't resolve in a pull request.
- Keep it short. Don't list every changed file, and don't repeat the commit messages one by one.

**Checklist:**

- Keep all items with the template's wording.
- Tick an item (`- [x]`) when it is done: the checks passed (step 2), tests were added or updated, the changelog entry exists, the generated files are up to date.
- For an item marked "(if applicable)" that doesn't apply, tick it as well and append the reason in a few words, e.g. "- [x] ... (if applicable): no behavior change". This way the pull request doesn't show open tasks for things that need no work.
- Leave an item unticked when it applies but isn't done (e.g. failing checks, or missing tests for changed behavior), and tell the user outside the code block.

### 6. Present the description for copying

Show the description in a single code block fenced with four backticks (` ````markdown `), because the description itself may contain code blocks with three backticks, which would otherwise end the outer block early. Don't save it to a file.

Don't add commentary inside the block, since everything in it ends up in the pull request. Notes for the user go after the block, in a few short lines, e.g.:

- that you added a changelog entry (or why none is needed)
- which checks failed, if any
- that no related issue was found, so they can add "Closes #..." themselves

When the user asks for changes, show the complete description again, not only the changed section, so it can still be copied with one click. Before the block, say in one line what changed.

## Example

For a branch that removes the unused dependency `foo` (which has an install script) from `tsPlugin/package.json`, with all checks passing, the reply contains:

<!-- prettier-ignore -->
````markdown
## Description

Remove the unused dependency `foo` from `tsPlugin/package.json`. It was not imported anywhere, but was still installed and listed as a dependency of the published npm package of the plugin.

- Remove `foo` from `tsPlugin/package.json` and update `tsPlugin/package-lock.json`.
- Remove `foo` from `allowedPackagesWithInstallScripts` in `.github/scripts/checkInstallScripts.mjs`, since it is not installed anymore.

## Sensitive files

- `tsPlugin/package.json`, `tsPlugin/package-lock.json`: remove the unused dependency `foo`. No dependency was added, and no versions changed.
- `.github/scripts/checkInstallScripts.mjs`: removes the allowlist entry for `foo`, which is no longer needed. The allowlist only gets smaller.

## Checklist

- [x] `npm run lint`, `npm run check-types`, `npm run compile` and `npm run test` pass
- [x] Tests were added or updated for the changed behavior (if applicable): no behavior change
- [x] `CHANGELOG.md` has an entry under `## [Unreleased]` for changes that are noticeable for users of the extension (if applicable): not noticeable for users
- [x] Generated files are up to date, e.g. via `npm run generate-syntaxes` (if applicable): no generated files affected
````

No changelog entry is needed, since the change only affects the development setup. No related issue was found in the branch name or the commits, so add "Closes #..." if there is one.
