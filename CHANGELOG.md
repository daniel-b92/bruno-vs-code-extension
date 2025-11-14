## [Unreleased]

### Fixes / Improvements
- Fix sequence for request file when created via collection explorer in folder without other requests.

## [0.17.9] (2025-11-09)

### Fixes / Improvements
- Add missing normalization of sequences for source directory when moving file to other folder.
- Avoid incorrectly showing warning that file is outside of valid collections by waiting a few seconds in case of the file being moved and the cache not being quite up to date yet.

## [0.17.8] (2025-11-09)

### Fixes / Improvements
- Fix sorting of requests and folders by sequence in test explorer view.
- Improve stability and transparency for language features.
  - Ensure that unique identifiers are used internally for the temp JS update requests.
  - Show notification when waiting longer than expected for temp JS update.
  - Show warning for `bru` files that are not inside a valid collection, that intellisense will be limited.


## [0.17.7] (2025-10-26)

### Fixes / Improvements
- Filter out incorrect diagnostics for `expect` statements referring to `JestMatchers` (only seems to have occured when using `@types/jest` npm package).
- Make handling of temp JS file updates more resilient by restarting entire queue when running into a timeout (instead of just throwing an error).

## [0.17.6] (2025-09-15)

### Fixes / Improvements
- Add a warning in the readme about using other extensions for `.bru` files simultaneously with this one.
- Add further advice on improving intellisense in the readme via `tsconfig` options.
- Filter out misleading Typescript error in `.bru` files stating that elements of an array implicitly have an `any` type.

## [0.17.5] (2025-09-06)

### Fixes / Improvements
- Improve performance for fetching completion items within code blocks of `.bru` files.
- Fix some Promise-related issues with queuing temporary JS file update requests that could have caused memory leaks.

## [0.17.4] (2025-09-04)

### Fixes / Improvements
- Add support for `tags` field in `meta` block of request files.
- Fix some issues related to temporary JS file updates:
  - Fix issue where no new temp JS file was created if the content of the last file was the same as for the new request, even if it was for a different path.
  - Fix issue where warnings were produced because of trying to clean up temp JS files when there weren't any existing ones.

## [0.17.3] (2025-09-01)

### Fixes / Improvements
- Fixes an issue, where an exception was thrown by the `Bruno` CLI process when triggering a testrun because of deletions of temp JS files in the background.
  - Deletions are canceled in this situation now.

## [0.17.2] (2025-08-30)

### Fixes / Improvements
- Fix issues from version `0.17.0` with providing intellisense for inbuilt `Bruno` functions in JS files.

## [0.17.1] (2025-08-24)

### Fixes / Improvements
- Reverts last few changes that were added for version `0.17.0` since some bigger issues have occured when working with that version.
- Do not show errors in JS files that are inside collections for inbuilt `Bruno` variables like `bru`, `req` and `res`.

## [0.17.0] (2025-08-24)
**Note: Version had to be withdrawn because of some bigger issues - will try to fix them and add the feature in an upcoming version again**

### Fixes / Improvements

- Do not show errors in JS files that are inside collections for inbuilt `Bruno` variables like `bru`, `req` and `res`.

### Features

- Provide intellisense for builtin Bruno functions (e.g. `bru.getVar(...)` or `res.getStatus()`) when used within JS files.

## [0.16.3] (2025-08-16)

### Fixes / Improvements

- Show suggestion for adding `tsconfig.json` files for each collection because otherwise the typescript language server runs into issues when trying to determine the project.
- Try to make intellisense features more reliable and faster by adding queuing of all update requests for temporary JS files and removing outdated requests from the queue whenever sensible.
- Fix parsing of curly brackets within code blocks, JSON request body blocks and plain text blocks ("docs").

## [0.16.2] (2025-07-28)

### Fixes

- Fix issue with tabs staying open after deleting item via collection explorer.

## [0.16.1] (2025-07-27)

### Fixes

- Fix issue with displaying error for allowed but redundant 'meta' block in collection settings file.
- Avoid causing errors when removing folders via collection explorer by switching to fs function instead of using VS Codes `applyEdit`.

## [0.16.0] (2025-07-24)

### Features

- Add syntax highlighting, snippet, completion items and diagnostics for new `settings` block in request files.
- Fix incorrect statement in last changelog regarding formatting: The VS Code setting for formatting on save is respected.
- Bump Bruno CLI version used for executing tests via npx to '2.8.0'

## [0.15.0] (2025-07-22)

### Features

- Add first version of formatting code blocks via prettier.

## [0.14.0] (2025-07-20)

### Features

- Provide diagnostics for collectons settings files

### Fixes / Improvements

- Make all file system operations async (for reducing waiting time before being able to continue with other actions for cases where a file system operation takes longer for some reason).
- Update all npm packages
- Bump Bruno CLI version used for executing tests via npx to '2.7.0'

## [0.13.1] (2025-07-16)

### Fixes

- Add missing adjustment for name field in meta block when renaming or duplicating a request file or a folder with a settings file

## [0.13.0] (2025-07-13)

### Features

- Add correct handling of folder sequences in explorer and in test runner.
- Add handling of cancellation tokens for language features.

## [0.12.3] (2025-07-02)

### Fixes

- Fix items being displayed multiple times after moving / renaming items via collection explorer.

## [0.12.2] (2025-07-01)

### Fixes

- Fix condition for aborting waiting state for temp js file to be in sync

## [0.12.1] (2025-06-29)

### Fixes

- Fix format of features list in readme

## [0.12.0] (2025-06-29)

### Features

- Add own output channel for extension for log messages and add logging for some events.

### Fixes

- Do not update diagnostics for `.bru` files on external modifications because it can lead to incorrect diagnostics when multiple files are updated.
- Avoid deadlocks while waiting for temporary js file to be updated and improve resilience of the waiting mechanism.

## [0.11.1] (2025-06-26)

### Fixes

- Update diagnostics for `.bru` files on deletions or external modifications

## [0.11.0] (2025-06-24)

### Features

- Add snippet for auth mode block in folder settings files
- Provide remaining diagnostics for folder settings files

### Fixes

- Add validation that path is unique when creating or renaming items in the collection explorer
- Add validation that dictionary blocks have at least one line of content

## [0.10.1] (2025-06-22)

### Fix

- Use smaller icon

## [0.10.0] (2025-06-22)

### Fix

- make default HTML report path independent of operating system

### Features

- provide some diagnostics for folder settings files (`folder.bru`)
