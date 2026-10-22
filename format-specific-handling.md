# Format-specific handling of collection files and folders

Places in the code base where collection files or folders are handled differently depending on the collection format (Bru vs. Yaml). This list comes from reading the code, not from running the extension. Line numbers refer to commit `f25567a0`.

Each entry is tagged:

- **[OK]**: the branching is intentional and looks correct.
- **[Gap]**: only one format is supported here (usually Bru). Known or expected while yaml support is in progress.
- **[Check]**: possible bug or inconsistency worth a closer look.

---

## 1. Central format-to-file-name mapping

- No relevant differences.

## 2. Collection detection and the `Collection` model

- No relevant differences.

## 3. Item type detection

- No relevant differences.

## 4. File system cache (`shared/fileSystemCache`)

- No open ToDos. Additional data (variable references) is derived from format-neutral `VariableScopeSection`s for both formats ([getAdditionalCollectionData.ts](shared/fileSystemCache/internal/getAdditionalCollectionData.ts)).

## 5. Shared parsing dispatchers (`shared/fileParsing/external/shared`)

- No relevant differences.

## 6. Client: collection explorer (tree view)

- No relevant differences.

## 7. Client: language features and cache syncing

- No relevant differences.

## 8. Server (language server)

- [handleCodeActionRequest.ts](server/src/bruFiles/quickFixes/handleCodeActionRequest.ts) **[Gap]**: quick fixes for URL ↔ params mismatches (`params:query` / `params:path` blocks) only exist for Bru.

## 9. TypeScript plugin

- No open ToDos.
