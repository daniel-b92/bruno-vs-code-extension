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