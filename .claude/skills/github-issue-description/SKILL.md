---
name: github-issue-description
description: Draft the title and description of a GitHub issue for a new feature, an enhancement or a technical task (refactoring, cleanup, tooling, test infrastructure) in this repository, ready to copy and paste into an issue the user creates manually on GitHub. Optionally also writes a markdown file with implementation details that the user can attach to the issue. Use this whenever the user wants to write, draft, prepare or formulate an issue, ticket, feature request or task description, or wants to "capture this idea for later" or "write this down as an issue", even if they don't say "GitHub". Not for bug reports.
---

# GitHub issue description

The user creates the issue on GitHub by hand. Your job is to give them text they can copy and paste without editing it: a title and a body, plus, if they want it, a separate markdown file with implementation details that they attach to the issue.

The issue is read by the maintainer later, often weeks after it was written, and possibly by Claude in a future session that is asked to implement it. Write so that someone without the current conversation understands what is wanted and why.

## Workflow

### 1. Understand the request

Collect what is known from the user's message and the conversation so far. Then look at the code that is involved, so the description of the current state is correct rather than guessed. You need enough to:

- **Check the premise.** The user often writes from memory, so the request may already be (partly) implemented, or the problem may look different than they think. Check this before drafting anything, because an issue for something that already ships wastes everyone's time. If the request is fully implemented, tell the user (where and how it works) and ask whether there is a gap left that they want an issue for, instead of drafting one. If it is partly implemented or the premise is out of date, narrow or reframe the issue to what is actually missing and say so in one line before the code blocks.
- **Describe today's behavior and the scope accurately.** For most issues this doesn't need a full implementation plan (that belongs in the optional details file). The exception is sweep-type tasks ("remove all places where…", "migrate every…"): there, the list of affected places _is_ the scope, so search thoroughly up front.

Decide which kind of issue it is:

- **Feature**: new functionality users of the extension can notice (e.g. a new diagnostic, completion, command or setting).
- **Enhancement**: a change to existing user-visible behavior.
- **Technical task**: no intended change in behavior, e.g. a refactoring, a cleanup, test infrastructure, build or tooling changes.

Ask the user only if the goal itself is unclear (you can't tell what should be different afterwards). For smaller gaps, make a sensible assumption and list it under "Open questions" in the issue, so the user can correct it before posting.

### 2. Draft the issue

Read the repository's issue template for the kind of issue and use its structure:

- Feature or enhancement: `.github/ISSUE_TEMPLATE/feature-or-enhancement.md`
- Technical task: `.github/ISSUE_TEMPLATE/technical-task.md`

The templates are the single source of truth for the sections, so the issues you draft look the same as ones written by hand from the template. Use the headings in their order. The frontmatter (`name`, `labels`, ...) is not part of the body. The HTML comments are hints for you: follow them, then remove them, together with optional sections that don't apply and empty placeholders like a bare `- [ ]`.

Guidelines:

- **Title**: short and specific, describing the outcome, e.g. "Add completions for request names in `bru.runRequest`" or "Move format-independent parsing utilities to `shared/fileParsing/external/shared/`". No prefixes like "Feature:" (labels do that job).
- **What and why, not how**: the body describes the problem, the desired result and how to tell it's done. Implementation steps go into the details file. For a technical task, naming the modules or folders involved is fine, because they are the subject of the task.
- **Code references**: use paths in backticks (`server/src/...`), not markdown links. Relative links don't resolve in a GitHub issue.
- **Keep it short**: as short as it can be while staying understandable; a small enhancement may need only a few lines per section. Don't fill sections with "None".
- **Don't repeat the details file**: if there will be one, keep risks and testing in the issue to a line each and leave the specifics to the file, so the two don't drift apart.

### 3. Present the issue for copying

Show the title and the body in two separate code blocks, so each can be copied with one click:

- The title in a plain code block (one line).
- The body in a code block fenced with four backticks (` ````markdown `), because the body itself may contain code blocks with three backticks, which would otherwise end the outer block early. This is about your chat reply; don't save the issue body to a file (a formatter may rewrite the fences there).

After the code blocks, add one line saying which template to choose under "New issue" on GitHub ("Feature or enhancement" or "Technical task"), since the template sets the labels, and that the prefilled body should be replaced with the copied one. Apart from that and a possible one-line note on a reframed premise before the blocks (see step 1), don't add commentary between or inside the blocks: anything inside them ends up in the issue.

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

## Proposed approach

The intended solution, step by step. Mention where new code should go, following the conventions in `CLAUDE.md` (e.g. the location of parsing utilities, handling both collection formats explicitly).

## Affected files

- `path/to/file.ts`: what changes there

## Alternatives considered

Other approaches and why they were not chosen.

## Testing

Which tests to add or extend, and which existing helpers in `shared/_testingUtils/` can be reused.

## Changelog

Whether the change will need a `CHANGELOG.md` entry (one line; the implementer writes the entry itself, following `CLAUDE.md`).

## Risks and open points
```

## Example

User: "Write an issue for adding hovers for request names in `bru.runRequest`."

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
