---
name: github-issue-description
description: Draft the title and description of a GitHub issue for a bug, a new feature, an enhancement or a technical task (refactoring, cleanup, tooling, test infrastructure) in this repository, ready to copy and paste into an issue the user creates manually on GitHub. Optionally also writes a markdown file with implementation details that the user can attach to the issue. Use this whenever the user wants to write, draft, prepare or formulate an issue, ticket, bug report, feature request or task description, or wants to "capture this idea for later" or "write this down as an issue", even if they don't say "GitHub".
---

# GitHub issue description

The user creates the issue on GitHub by hand. Your job is to give them text they can copy and paste without editing it: a title and a body, plus, if they want it, a separate markdown file with implementation details that they attach to the issue.

The issue is read by the maintainer later, often weeks after it was written, and possibly by Claude in a future session that is asked to implement or fix it. Write so that someone without the current conversation understands what is wanted and why.

## Workflow

### 1. Understand the request

Collect what is known from the user's message and the conversation so far. Then look at the code that is involved, so the description of the current state is correct rather than guessed. You need enough to:

- **Check the premise.** The user often writes from memory, so the request may already be (partly) implemented, or the problem may look different than they think. Check this before drafting anything, because an issue for something that already ships wastes everyone's time.
    - If nothing in the spirit of the request is left to do, tell the user where and how it works, and ask whether there is a gap left that they want an issue for, instead of drafting one.
    - If the literal request is done but related work in the same spirit remains, or only part of it is implemented, or the premise is out of date, narrow or reframe the issue to what is actually missing. Say so briefly (one or two sentences) before the code blocks.
    - For a bug, check whether it is already fixed (in the code and under `## [Unreleased]` in `CHANGELOG.md`) and whether the behavior is actually intended. If it is intended, say why, and offer an enhancement issue instead.
- **Describe today's behavior and the scope accurately.** For most issues this doesn't need a full implementation plan (that belongs in the optional details file). The exception is sweep-type tasks ("remove all places where…", "migrate every…"): there, the list of affected places _is_ the scope, so search thoroughly up front.
- **For a bug, find out where it comes from**, as far as that is possible without much effort: which feature and which code path are affected, and under which conditions it occurs (e.g. only in one collection format or one block type). This keeps the steps to reproduce minimal and correct. You don't need to confirm the exact cause for the issue itself.

Decide which kind of issue it is:

- **Bug**: existing behavior doesn't work as intended (e.g. a wrong or missing diagnostic, a completion that doesn't show up, an error message, a crash).
- **Feature**: new functionality users of the extension can notice (e.g. a new diagnostic, completion, command or setting).
- **Enhancement**: a change to existing user-visible behavior that works as designed today.
- **Technical task**: no intended change in behavior, e.g. a refactoring, a cleanup, test infrastructure, build or tooling changes.

Ask the user only if the goal itself is unclear (you can't tell what should be different afterwards, or for a bug, what goes wrong). For smaller gaps, make a sensible assumption and list it under "Open questions" in the issue (for a bug, under "Additional context"), so the user can correct it before posting.

If you asked a question in this step instead of drafting the issue (e.g. because the request is already implemented), use the AskUserQuestion tool if available, offering the gaps you found as options. Skip step 4 in that case.

### 2. Draft the issue

Read the repository's issue template for the kind of issue and use its structure:

- Bug: `.github/ISSUE_TEMPLATE/bug-report.md`
- Feature or enhancement: `.github/ISSUE_TEMPLATE/feature-or-enhancement.md`
- Technical task: `.github/ISSUE_TEMPLATE/technical-task.md`

The templates are the single source of truth for the sections, so the issues you draft look the same as ones written by hand from the template. Use the headings in their order. The frontmatter (`name`, `labels`, ...) is not part of the body. The HTML comments are hints for you: follow them, then remove them, together with optional sections that don't apply and empty placeholders like a bare `- [ ]`.

Guidelines:

- **Title**: short and specific. For a feature, an enhancement or a technical task, describe the outcome, e.g. "Add completions for request paths in `bru.runRequest`" or "Move format-independent parsing utilities to `shared/fileParsing/external/shared/`". For a bug, describe the faulty behavior, e.g. "Diagnostics are shown at the wrong line in `.bru` files with CRLF line endings". No prefixes like "Feature:" or "Bug:" (labels do that job).
- **What and why, not how**: the body describes the problem, the desired result and how to tell it's done. Implementation steps go into the details file. For a technical task, naming the modules or folders involved is fine, because they are the subject of the task.
- **Code references**: use paths in backticks (`server/src/...`), not markdown links. Relative links don't resolve in a GitHub issue.
- **Keep it short**: as short as it can be while staying understandable; a small enhancement may need only a few lines per section. Don't fill sections with "None".
- **Don't repeat the details file**: if there will be one, keep risks and testing in the issue to a line each and leave the specifics to the file, so the two don't drift apart. For sweep-type tasks, list the affected files in the issue's scope (grouped if that helps), and leave the functions and what changes in each to the details file. Without a details file, name the functions in the issue.

For a bug report, also:

- **Steps to reproduce**: give the smallest setup that shows the problem, with the contents of the affected `.bru` or `yaml` files inline (shortened to what matters) and where they are located in the collection.
- **Environment**: fill in only what is known from the conversation and remove the other lines. Don't guess versions.
- **Cause**: if you found the likely cause in step 1, mention it in one line under "Additional context" (e.g. the function involved), marked as suspected if you didn't confirm it. The analysis itself goes into the details file.

### 3. Present the issue for copying

Show the title and the body in two separate code blocks, so each can be copied with one click:

- The title in a plain code block (one line).
- The body in a code block fenced with four backticks (` ````markdown `), because the body itself may contain code blocks with three backticks, which would otherwise end the outer block early. This is about your chat reply; don't save the issue body to a file (a formatter may rewrite the fences there).

After the code blocks, add one line saying which template to choose under "New issue" on GitHub ("Bug report", "Feature or enhancement" or "Technical task"), since the template sets the labels, and that the prefilled body should be replaced with the copied one. Apart from that and a possible short note on a reframed premise before the blocks (see step 1), don't add commentary between or inside the blocks: anything inside them ends up in the issue.

Writing an issue changes no code, so the `CHANGELOG.md` rule from `CLAUDE.md` doesn't apply to this reply.

### 4. Offer the implementation-details file

Unless the user already said whether they want one, ask in the same turn, right after presenting the issue (with the AskUserQuestion tool if available), whether you should also write an implementation-details file to attach to the issue. If they decline, you are done.

If they accept, write it to `issue-drafts/<slug>-implementation.md` in the repository root, where `<slug>` is a short kebab-case version of the title. The folder is ignored by git (check that `.gitignore` still contains `issue-drafts/`, and add it if not). Then:

- Give the user the file's path.
- Give them a short snippet to append to the issue body, in its own code block:

    ```markdown
    ## Implementation notes

    See the attached file.
    ```

    and tell them to drag the file into the issue editor below this heading (GitHub accepts `.md` attachments and inserts a link to the file).

### Contents of the implementation-details file

This file is for whoever implements the issue, quite possibly Claude in a later session. It is attached to the issue and read on its own, outside the repository, so make it self-contained and give paths relative to the repository root in backticks (again no markdown links).

Investigate the code more thoroughly here than for the issue itself: name the actual files, functions and types involved, and check that they exist. Use names rather than line numbers, because line numbers go stale quickly.

Suggested structure (leave out sections that don't apply):

```markdown
# Implementation notes: <issue title>

## Current state

How the relevant code works today: entry points, data flow, the files and symbols involved.

## Cause

Only for a bug: where and why the code goes wrong. Say whether you confirmed it (e.g. with a failing test) or whether it is suspected.

## Proposed approach

The intended solution, step by step. Mention where new code should go, following the conventions in `CLAUDE.md` (e.g. the location of parsing utilities, handling both collection formats explicitly).

## Affected files

- `path/to/file.ts`: what changes there

## Alternatives considered

Other approaches and why they were not chosen.

## Testing

Which tests to add or extend (for a bug, a test that fails without the fix), and which existing helpers in `shared/_testingUtils/` can be reused.

## Changelog

Whether the change will need a `CHANGELOG.md` entry (one line; the implementer writes the entry itself, following `CLAUDE.md`).

## Risks and open points
```

## Example

User: "Write an issue for adding hovers for request paths in `bru.runRequest`."

After looking at how `bru.runRequest` calls are currently handled, the reply contains:

```
Show hovers for request paths in `bru.runRequest`
```

````markdown
## Summary

Show a hover for the request path passed to `bru.runRequest` in scripts, with the name and method of the referenced request.

## Motivation

`bru.runRequest("folder/request")` refers to another request by its path. Today, there is no way to check which request is meant without opening the file, and a typo only shows up at runtime.

## Proposed behavior

Hovering over the path argument shows the request's name, method and URL:

```js
await bru.runRequest("users/get-user");
//                    ^ hover: GET {{baseUrl}}/users/:id (get-user)
```

This works in `.bru` files and in `yaml` collections.

## Acceptance criteria

- [ ] Hovering over an existing request path shows name, method and URL
- [ ] No hover is shown for paths that don't refer to a request
- [ ] Works for both collection formats

## Open questions

- Should a missing request be reported as a diagnostic as well? (assumed: separate issue)
````

Choose the "Feature or enhancement" template on GitHub and replace its prefilled body with the one above.
