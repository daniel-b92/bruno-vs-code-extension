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

**Server**

- `getFilePathAndType` falls back to `Yml` for any file that is neither `.bru` nor `.js`. This relies on the client's document selectors.
- Completion and hover only handle `Bru` and `Js` and return nothing for `Yml`, which is safe. Diagnostics route `Yml` to the yaml provider and will-save updates only run for `Bru`, which is fine.

**Handled correctly**

- `getItemType` and the settings file name helpers are format-aware.
- Client `getItemType` callers pass the collection, so the format is derived from it.
- The language features under `brunoFiles` / `bruFiles` are only reached for `.bru` documents.
- The `tsPlugin` `.bru` checks are intentional.
