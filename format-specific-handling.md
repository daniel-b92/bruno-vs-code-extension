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

- [getCollectionItem.ts:65-86](shared/fileSystemCache/internal/getCollectionItem.ts#L65-L86) **[OK]**:
- [getAdditionalCollectionData.ts:37-43](shared/fileSystemCache/internal/getAdditionalCollectionData.ts#L37-L43) **[Gap]**: full-parsing additional data is only computed for Bru; yaml items get `getData(undefined)`. This matters for the server's variable references (see [helpersProvider.ts:56-80](server/src/shared/helpersProvider.ts#L56-L80), which is built on Bru blocks via `getAllVariablesFromBlocks`). There is already a ToDo for this.
- [collectionItemProvider.ts:377-395](shared/fileSystemCache/external/collectionItemProvider.ts#L377-L395) **[OK]**: when the collection root file is modified, a Bru collection only refreshes `additionalContextRoots` and returns. A Yaml collection then goes on to the settings-file handling, because `opencollection.yml` is also the collection settings file.
- [collectionItemProvider.ts:47-61](shared/fileSystemCache/external/collectionItemProvider.ts#L47-L61) **[Check]**: deleting the collection root file counts as deleting the collection. For yaml this also covers deleting the collection settings file, while deleting `collection.bru` in a Bru collection only removes one item.
    - Side note, not format-specific: `handleCollectionDeletion(path)` receives the _root file_ path here. `CollectionRegistry.unregisterCollection` compares it against root _directories_, so deleting only the root file seems to log a warning instead of unregistering the collection.
- [registerMissingCollectionsAndTheirItems.ts:77-126](shared/fileSystemCache/internal/registerMissingCollectionsAndTheirItems.ts#L77-L126) **[OK]**: passes `collection.getFormat()` through to all format-aware helpers.

## 5. Shared parsing dispatchers (`shared/fileParsing/external/shared`)

- [parseSequenceFromFile.ts:16-45](shared/fileParsing/external/shared/parseSequenceFromFile.ts#L16-L45) **[OK]**: dispatches on the file extension. `.yml` files are read through `parseInfoFromYamlFile` (as a folder settings file if the file name is `folder.yml`, otherwise as a request file). Every other file goes to the Bru meta block parser, which in turn ignores non-`.bru` files.
- [getSequenceValueRangeFromFileContent.ts:22-59](shared/fileParsing/external/shared/getSequenceValueRangeFromFileContent.ts#L22-L59) **[OK]**: dispatches on the extension. Yaml additionally trims trailing whitespace before comments. Returns `undefined` for unknown extensions.
- [getFolderSettingsFilePath.ts:10-30](shared/fileParsing/external/shared/getFolderSettingsFilePath.ts#L10-L30) **[OK]**: requires the format explicitly.

## 6. Client: collection explorer (tree view)

- [createRequestFile.ts:43-44](client/src/treeView/internal/explorer/fileUtils/createRequestFile.ts#L43-L44), [createRequestFile.ts:175-232](client/src/treeView/internal/explorer/fileUtils/createRequestFile.ts#L175-L232) **[OK]**: the extension depends on the collection format. Content is either Bru `meta` + method block, or yaml `info` + request-type section serialised with `yaml.stringify`. For yaml, gRPC requests get no `method`, and the auth/body defaults written for Bru (`auth: none`, `body: none`/`ws`) are not written.
- [replaceNameInMetaBlock.ts:35-38](client/src/treeView/internal/explorer/fileUtils/replaceNameInMetaBlock.ts#L35-L38) **[OK]**: replaces the name in the Bru `meta.name` field or the yaml `info.name` field.
- [collectionExplorer.ts:510-544](client/src/treeView/internal/collectionExplorer.ts#L510-L544) (rename) **[Check]**: renaming a **collection root folder** looks up the root folder's settings file and replaces the name in it.
    - Yaml: this is `opencollection.yml`, so `info.name` (the collection name) is rewritten to the new folder name.
    - Bru: this is `collection.bru`, which normally has no `meta` name, and the name in `bruno.json` is not touched. So the collection name only changes for yaml.
    - For folders, `oldItem.getItemType()` is `Directory` (not `FolderSettingsFile`). This currently works because the name is parsed for every file type.
- [handleFileInsertion.ts:45-116](client/src/treeView/internal/explorer/fileUtils/handleFileInsertion.ts#L45-L116) **[OK]** / **[Check]**: the name replacement and the settings-file confirmation dialogs use the **target** collection's format.
    - Copying or pasting a file from a Bru collection into a Yaml collection (or the other way round) is not handled: the file keeps its original extension and content, and is then treated as `OtherFileType`.
    - The `replace(getFileExtensionForFormat(format), "")` call does not remove the foreign extension.
- [collectionExplorer.ts:174-213](client/src/treeView/internal/collectionExplorer.ts#L174-L213) + [moveFileIntoFolder.ts](client/src/treeView/internal/explorer/fileUtils/moveFileIntoFolder.ts) **[Check]**: drag and drop of files between collections does not look at the formats either. The same cross-format issue applies as for copy/paste.
- [updateSequencesAfterMovingFolder.ts:28-37](client/src/treeView/internal/explorer/folderUtils/updateSequencesAfterMovingFolder.ts#L28-L37) **[Check]**: takes the format from the **source** collection. That format is then used to look up folder settings files in the target folder. This is only relevant when moving folders between collections of different formats.
- [updateSettingsFileOfDuplicatedFolder.ts:26-49](client/src/treeView/internal/explorer/folderUtils/updateSettingsFileOfDuplicatedFolder.ts#L26-L49), [getSequencesForFolders.ts:41-50](client/src/shared/fileParsing/folderSettings/getSequencesForFolders.ts#L41-L50) **[OK]**: pass the collection format through.
- [replaceSequenceForFile.ts](client/src/treeView/internal/explorer/fileUtils/replaceSequenceForFile.ts), [normalizeSequencesForRequestFiles.ts](client/src/treeView/internal/explorer/fileUtils/normalizeSequencesForRequestFiles.ts), [normalizeSequencesForFolders.ts](client/src/treeView/internal/explorer/folderUtils/normalizeSequencesForFolders.ts) **[OK]**: format-independent; they rely on the extension-based dispatchers in section 5.
- [getDeleteConfirmationMessage.ts:14](client/src/treeView/internal/explorer/getDeleteConfirmationMessage.ts#L14) **[OK]**: strips whatever extension the file has (`extname`), so it works for both formats.

## 7. Client: language features and cache syncing

- [activateLanguageFeatures.ts:144](client/src/languageFeatures/activateLanguageFeatures.ts#L144), [activateLanguageFeatures.ts:214](client/src/languageFeatures/activateLanguageFeatures.ts#L214) **[Gap]**: temp JS file handling (script intellisense) only runs when a `.bru` document is opened or saved. Yaml files with scripts get no JS intellisense.
- [getRequestFileDocumentSelector.ts:5](client/src/languageFeatures/internal/brunoFiles/shared/getRequestFileDocumentSelector.ts#L5) **[Gap]**: the client-side completion, hover, definition and signature help providers for code blocks are registered for `**/*.bru` only.
- [activateLanguageFeatures.ts:170-204](client/src/languageFeatures/activateLanguageFeatures.ts#L170-L204) **[OK]**: `onDidChangeTextDocument` is format-independent; it waits for the cache for yaml request files too.
- [determineFilesToCheckWhetherInSync.ts:41](client/src/shared/fileSystemCache/internal/determineFilesToCheckWhetherInSync.ts#L41), [determineFilesToCheckWhetherInSync.ts:91-104](client/src/shared/fileSystemCache/internal/determineFilesToCheckWhetherInSync.ts#L91-L104) **[OK]**: format-independent through `parseSequenceFromFile` and `getItemType`.
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

---

## Summary of items worth acting on

1. **Server env names for JS files in yaml collections** use the `.bru` extension (section 8): small, clear fix.
2. **tsPlugin collection detection** ignores `opencollection.yml` (section 9).
3. **Yaml diagnostics run for every yaml file in the workspace** and guess the file type instead of using the cache (section 8).
4. **Activation event** only covers `*.bru` (section 7).
5. **Renaming a collection root folder** renames the collection only for yaml (section 6). Decide whether this is wanted.
6. **Cross-format copy, paste and move** between Bru and Yaml collections is not handled (section 6).
7. Root-file deletion handling (section 4, side note).
8. Feature gaps for yaml (additional data/variable references, formatting, completions, hover, auto updates, script intellisense, cross-file diagnostics) are expected at this stage and are listed above for completeness.
