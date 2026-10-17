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

- [getAdditionalCollectionData.ts:37-43](shared/fileSystemCache/internal/getAdditionalCollectionData.ts#L37-L43) **[Gap]**: full-parsing additional data is only computed for Bru; yaml items get `getData(undefined)`. This matters for the server's variable references (see [helpersProvider.ts:56-80](server/src/shared/helpersProvider.ts#L56-L80), which is built on Bru blocks via `getAllVariablesFromBlocks`). There is already a ToDo for this.

## 5. Shared parsing dispatchers (`shared/fileParsing/external/shared`)

- No relevant differences.

## 6. Client: collection explorer (tree view)

- No relevant differences.

## 7. Client: language features and cache syncing

- No relevant differences.

## 8. Server (language server)

- [server.ts:134-140](server/src/server.ts#L134-L140) **[Gap]**: formatting is only provided for Bru.
- [server.ts:185-190](server/src/server.ts#L185-L190) / [server.ts:248-253](server/src/server.ts#L248-L253) **[Gap]**: completions and hover are only provided for Bru and JS files.
- [server.ts:257-259](server/src/server.ts#L257-L259) **[Gap]**: will-save auto updates (URL ↔ params syncing, [runUpdatesOnWillSave.ts](server/src/bruFiles/autoUpdates/runUpdatesOnWillSave.ts)) only run for Bru.
- [server.ts:116-128](server/src/server.ts#L116-L128) **[OK]**: diagnostics refresh on sequence changes regardless of format. The yaml provider checks sequence uniqueness for request files and folder settings files as well.
- [mapStaticEnvVariablesToCompletions.ts:36-39](server/src/shared/environmentVariables/mapStaticEnvVariablesToCompletions.ts#L36-L39), [getHoverContentForStaticEnvVariables.ts:36-39](server/src/shared/environmentVariables/getHoverContentForStaticEnvVariables.ts#L36-L39) **[Check]**: the environment name is computed as `basename(file, getExtensionForBrunoFiles())`. These helpers are shared with **JS file** completions and hover, which also work inside yaml collections. There the environment would be shown as e.g. `local.yml` instead of `local`. Using `collection.getEnvironments()` (or `getFileExtensionForFormat(collection.getFormat())`) would fix this.
- `server/src/bruFiles/**` (e.g. [getCompletionsForPositionOutsideOfBlocks.ts:182](server/src/bruFiles/completions/getCompletionsForPositionOutsideOfBlocks.ts#L182), [getDictionaryBlockSnippetInsertionContent.ts:112](server/src/bruFiles/completions/dictionaryBlocks/generic/getDictionaryBlockSnippetInsertionContent.ts#L112)) **[OK]**: uses of `getExtensionForBrunoFiles()` here are intentional, since these code paths are only reached for `.bru` documents.

## 9. TypeScript plugin

- No open ToDos.
