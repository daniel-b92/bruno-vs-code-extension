# Yaml collection caching: things to be aware of

The feature toggle `yamlCollectionSupport` (see `shared/featureToggles/featureToggles.ts`) gates the registration of yaml collections: `getAllCollectionRootDirectories` only returns yaml roots when it is on. With the toggle off, only bru collections are ever registered in the cache.

## Issues occurring without the feature toggle activated

- **Stale declarations:** the client type-check reads the git-ignored `shared/out`. It failed with a stale-argument-count error until `tsc -b` was run in `shared/`. (Development setup issue, not a runtime issue.)

The code audit (see below) found no `.bru` assumption that is reachable without the toggle, because no yaml collection is registered then. Bru behaviour itself was not changed by the yaml cache commit as far as this audit could tell, but it was not re-verified manually.

## Issues only relevant with the feature toggle activated

### Known, from implementation

- **Yaml additional data is empty:** for yaml items the server's additional data (the variable references) is empty for now, since that parsing is bru-only. There is a ToDo in `getAdditionalCollectionData`.
- **Missing folder settings file:** an unreadable `folder.yml` now still yields a directory with no sequence. In the bru path it drops the item.

### Consumers of the cache that assume only `bru` files (code audit)

Per the decision made during planning, consumers get yaml collections as they are. The following assumptions were found by reading the code (not by running the extension):

**Test runner**

- `isRelevantForTestTree` (`client/src/testRunner/activateRunner.ts`) requires `extname(path) == ".bru"` for files. A newly created or deleted yaml request is never added to or removed from the test tree.
- The "Modified" branch in the same file has the same check. Changes to the sequence or tags of a yaml request do not update the tree.
- The initial tree build (`TestRunnerDataHelper.getTestFileDescendants`) reads the cache and has no extension check. The initial tree therefore shows yaml requests, but live updates ignore them.

**Sequence parsing is bru-only**

- `parseSequenceFromMetaBlock` returns `undefined` for anything that is not `.bru`. `getSequenceForFile` and `getSequenceForFolder` rely on it, so everything that reads sequences does not work for yaml: `getSequencesForRequests`, `getSequencesForFolders`, max-sequence calculation, normalizing sequences, and updating sequences after inserting or moving items.
- `FileSystemCacheSyncingHelper.isCachedFileInSync` compares `parseSequenceFromMetaBlock(file)` (always `undefined` for yaml) with the cached sequence. A yaml request with a sequence is therefore never "in sync", so waiting for the cache to catch up probably runs until its timeout. `determineFilesToCheckWhetherInSync` has the same gap.
- `getTestFileDescendants` (`shared/fileSystem/util/getTestFileDescendants.ts`) globs `**/*.bru`. Its only caller `getCollectionRootData` is currently only used for bru collections, so this is harmless for now.

**Tree view write operations** (the tree view displays yaml items correctly, because it reads cached item types)

- `createRequestFile` creates `.bru` files with bru content in a yaml collection.
- `showDialogForSettingEnvironment` and `getDeleteConfirmationMessage` strip `.bru` from environment file names, so yaml environments show up as "name.yml".
- `handleFileInsertion` (name stripping, warning messages, `doesFileNameMatchFolderSettingsFileName(newPath)`) and the rename logic in `collectionExplorer` use `getExtensionForBrunoFiles()` and call `replaceNameInMetaBlock`, which uses `parseBruFile` and would parse yaml as bru.
- `collectionExplorer` (rename / copy of folders) calls `getFolderSettingsFilePath` without a format, which defaults to `Bru`. `folder.yml` is not found.

**Server**

- `getFilePathAndType` falls back to `Yml` for any file that is neither `.bru` nor `.js`. This relies on the client's document selectors.
- Completion and hover only handle `Bru` and `Js` and return nothing for `Yml`, which is safe. Diagnostics route `Yml` to the yaml provider and will-save updates only run for `Bru`, which is fine.

**Handled correctly**

- `getItemType` and the settings file name helpers are format-aware.
- Client `getItemType` callers pass the collection, so the format is derived from it.
- The language features under `brunoFiles` / `bruFiles` are only reached for `.bru` documents.
- The `tsPlugin` `.bru` checks are intentional.
