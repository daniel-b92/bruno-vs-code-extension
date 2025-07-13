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