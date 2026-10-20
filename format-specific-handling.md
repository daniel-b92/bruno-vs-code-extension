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

- [server.ts:291-296](server/src/server.ts#L291-L296) **[Gap]**: hover is only provided for Bru and JS files. Completions are provided for yaml files as well ([yamlFiles/completions/handleCompletionRequest.ts](server/src/yamlFiles/completions/handleCompletionRequest.ts)), covering keys, enum/boolean values, `info.seq`, `info.tags` and environment `extends`, but not yet variables.
- [server.ts:299-301](server/src/server.ts#L299-L301) **[Gap]**: will-save auto updates (URL ↔ params syncing, [runUpdatesOnWillSave.ts](server/src/bruFiles/autoUpdates/runUpdatesOnWillSave.ts)) only run for Bru.
- [mapStaticEnvVariablesToCompletions.ts:36-39](server/src/shared/environmentVariables/mapStaticEnvVariablesToCompletions.ts#L36-L39), [getHoverContentForStaticEnvVariables.ts:36-39](server/src/shared/environmentVariables/getHoverContentForStaticEnvVariables.ts#L36-L39) **[Check]**: the environment name is computed as `basename(file, getExtensionForBrunoFiles())`. These helpers are shared with **JS file** completions and hover, which also work inside yaml collections. There the environment would be shown as e.g. `local.yml` instead of `local`. Using `collection.getEnvironments()` (or `getFileExtensionForFormat(collection.getFormat())`) would fix this.
- `server/src/bruFiles/**` (e.g. [getDictionaryBlockSnippetInsertionContent.ts:113](server/src/bruFiles/completions/dictionaryBlocks/generic/getDictionaryBlockSnippetInsertionContent.ts#L113)) **[OK]**: hard-coded uses of `getFileExtensionForFormat(CollectionFormat.Bru)` here are intentional, since these code paths are only reached for `.bru` documents.

## 9. TypeScript plugin

- No open ToDos.
