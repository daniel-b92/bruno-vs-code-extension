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

- [activateLanguageFeatures.ts:144](client/src/languageFeatures/activateLanguageFeatures.ts#L144), [activateLanguageFeatures.ts:214](client/src/languageFeatures/activateLanguageFeatures.ts#L214) **[Gap]**: temp JS file handling (script intellisense) only runs when a `.bru` document is opened or saved. Yaml files with scripts get no JS intellisense.
- [getRequestFileDocumentSelector.ts:5](client/src/languageFeatures/internal/brunoFiles/shared/getRequestFileDocumentSelector.ts#L5) **[Gap]**: the client-side completion, hover, definition and signature help providers for code blocks are registered for `**/*.bru` only.
- [extension.ts:134-141](client/src/extension.ts#L134-L141) **[OK]** / **[Check]**: the `yaml` language is added to the LSP document selector only when the toggle is on. **All** yaml documents in the workspace are then sent to the server, not just those inside collections (see the server section).
- [package.json:32-34](package.json#L32-L34) **[Gap]**: the only activation event is `workspaceContains:**/*.bru`. A workspace that only contains yaml collections does not activate the extension.

## 8. Server (language server)

- [server.ts:48-53](server/src/server.ts#L48-L53), [server.ts:405-418](server/src/server.ts#L405-L418) **[Check]**: `getFilePathAndType` treats every file that is neither `.bru` nor `.js` as `Yml` (including `.yaml`). This relies on the client's document selector.
- [server.ts:134-140](server/src/server.ts#L134-L140) **[Gap]**: formatting is only provided for Bru.
- [server.ts:185-190](server/src/server.ts#L185-L190) / [server.ts:248-253](server/src/server.ts#L248-L253) **[Gap]**: completions and hover are only provided for Bru and JS files.
- [server.ts:257-259](server/src/server.ts#L257-L259) **[Gap]**: will-save auto updates (URL ↔ params syncing, [runUpdatesOnWillSave.ts](server/src/bruFiles/autoUpdates/runUpdatesOnWillSave.ts)) only run for Bru.
- [server.ts:199-218](server/src/server.ts#L199-L218) **[OK]**: diagnostics are routed to the Bru or Yaml provider by extension.
- [server.ts:351-389](server/src/server.ts#L351-L389) **[Check]**: the yaml file type is guessed from the path, file name or content instead of the cached item type (ToDos exist). Some consequences:
    - The file names `opencollection.yml` and `folder.yml` are hard-coded instead of using `getCollectionSettingsFileName` / `getFolderSettingsFileName`.
    - There is **no check that the file belongs to a yaml collection**: any `.yml`/`.yaml` file in the workspace (CI configs, docker-compose, …) gets request-file diagnostics once the toggle is on.
    - Bru diagnostics, by contrast, use the cached item type ([server.ts:332-349](server/src/server.ts#L332-L349)) and therefore require a registered collection.
- [server.ts:116-128](server/src/server.ts#L116-L128) **[OK]**: diagnostics refresh on sequence changes regardless of format. It has no effect for yaml yet, because there is no yaml sequence-uniqueness check (see the next item).
- **[Gap]** Cross-file diagnostics that exist for Bru but not for Yaml:
    - [checkSequenceInMetaBlockIsUniqueWithinFolder.ts](server/src/bruFiles/diagnostics/requestFiles/checks/relatedRequests/checkSequenceInMetaBlockIsUniqueWithinFolder.ts)
    - [checkFolderSequenceInMetaBlockIsUnique.ts](server/src/bruFiles/diagnostics/folderSettingsFiles/checks/checkFolderSequenceInMetaBlockIsUnique.ts)
    - [checkExtendsFieldIsValid.ts](server/src/bruFiles/diagnostics/environmentFiles/checkExtendsFieldIsValid.ts)
    - [checkExtendsFieldDoesNotCreateInheritanceLoop.ts](server/src/bruFiles/diagnostics/environmentFiles/checkExtendsFieldDoesNotCreateInheritanceLoop.ts)
    - [checkExtendsFieldIsNotDefinedMultipleTimes.ts](server/src/bruFiles/diagnostics/environmentFiles/checkExtendsFieldIsNotDefinedMultipleTimes.ts)
- [mapStaticEnvVariablesToCompletions.ts:36-39](server/src/shared/environmentVariables/mapStaticEnvVariablesToCompletions.ts#L36-L39), [getHoverContentForStaticEnvVariables.ts:36-39](server/src/shared/environmentVariables/getHoverContentForStaticEnvVariables.ts#L36-L39) **[Check]**: the environment name is computed as `basename(file, getExtensionForBrunoFiles())`. These helpers are shared with **JS file** completions and hover, which also work inside yaml collections. There the environment would be shown as e.g. `local.yml` instead of `local`. Using `collection.getEnvironments()` (or `getFileExtensionForFormat(collection.getFormat())`) would fix this.
- `server/src/bruFiles/**` (e.g. [checkExtendsFieldIsValid.ts:16](server/src/bruFiles/diagnostics/environmentFiles/checkExtendsFieldIsValid.ts#L16), [getCompletionsForPositionOutsideOfBlocks.ts:182](server/src/bruFiles/completions/getCompletionsForPositionOutsideOfBlocks.ts#L182), [getDictionaryBlockSnippetInsertionContent.ts:112](server/src/bruFiles/completions/dictionaryBlocks/generic/getDictionaryBlockSnippetInsertionContent.ts#L112)) **[OK]**: uses of `getExtensionForBrunoFiles()` here are intentional, since these code paths are only reached for `.bru` documents.

## 9. TypeScript plugin

- [tsPlugin/src/index.ts:479-505](tsPlugin/src/index.ts#L479-L505) **[Check]**: `isACollectionRootFolder` only recognises folders containing a `bruno.json` with `type: "collection"`. JS files inside **yaml** collections are therefore not seen as "in a Bruno collection", so the plugin's special handling is skipped for them:
    - filtering temp-file completions,
    - protecting inbuilt runtime functions from renaming,
    - suppressing diagnostics.
- [tsPlugin/src/index.ts:507-509](tsPlugin/src/index.ts#L507-L509) **[OK]**: `isBrunoFile` only matches `.bru`. This is intentional, since only Bru files embed JS code blocks that the TS server sees.
