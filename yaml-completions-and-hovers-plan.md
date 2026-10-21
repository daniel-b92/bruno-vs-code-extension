# Completions and hovers for yaml files

## Context

`format-specific-handling.md` §8, second bullet: `onCompletion`/`onHover` in [server.ts](server/src/server.ts) only dispatch `FileTypeByExtension.Bru` and `.Js`, so yaml files get neither feature. `ParsedYamlMap.missingProperties` was added as groundwork for this. The task is to check whether it can drive these features generically and, if not, design something that can. Target: parity with Bru, as decided. Bru offers:

- **Completions:** keys, fixed values, `{{var}}` in non-code blocks, variable names in `bru.getEnvVar("…")`, tags, `seq`, env `extends`.
- **Hovers:** variables in code and non-code blocks, tag usages. There are no key or value documentation hovers.

## Verdict: `missingProperties` is not usable for this

I checked against the parser code and verified the `yaml` library's behavior with throwaway scripts.

1. **It is missing exactly when completions are requested.** If `document.errors` isn't empty, [parseDocumentIntoYamlMap.ts](shared/fileParsing/internal/yamlFormat/util/parseDocumentIntoYamlMap.ts) returns no result at all. A half-typed key (`  ur` below `method: GET`) is a `MISSING_CHAR` error, so the whole file has no `missingProperties`.
2. **The parent isn't a map yet.** `http:\n  ur` parses `http` as the scalar `"ur"`, so `parseHttpSection` never runs.
3. **Discriminator maps bail out early.** `tryToParseAuthTypeField` (parseAuthFromYamlMapOrScalar.ts) calls `getMapItems` directly and returns before any validated map exists when `type` is missing or invalid. So right after `auth:`, or while typing `type: ba`, there is nothing.
4. **There's no position info.** The top-level map and auth maps have no range. Yaml map ranges also end before trailing blank lines: `http` covers `[24,36]` while the cursor on the blank line is at 38. So "cursor on an empty line in map X" can't be found from ranges.
5. **There's too little info per key.** It only has `key`, `isMandatory` and `alwaysHasScalarValue`. Missing: the value kind (needed for the insert text), enum values, and anything about keys that are present.
6. **It can't be walked generically.** The `properties` shapes differ everywhere (wrappers, `EnabledAndDisabledItems`, arrays, `OptionalVariableFieldResult`).
7. **It's irrelevant for hover.**

What it gets right, and what the replacement keeps: **context dependence**. Only the parser knows which keys are valid _here_: per request type, per auth type and OAuth2 sub-map, per request type's settings. A separate declarative schema would duplicate the ~50 `getValidatedMapItems` call sites.

## Design overview

1. **Map descriptors.** `getValidatedMapItems` is the single choke point every map parser goes through. It records a `YamlMapDescriptor` for each map it validates: the expected keys with kinds, mandatory flags and allowed values, plus the defined keys with ranges.
2. **Tolerant parsing.** Language features parse without stopping at yaml syntax errors.
3. **Patch the cursor line, then parse.** A placeholder key on the cursor line lets the `yaml` library decide by indentation which map the cursor belongs to. Then the matching descriptor is looked up.
4. **Variables.** A format-neutral `VariableScopeSection` replaces `Block` as the input of the variable machinery. It states explicitly what the machinery today derives from Bru block names (execution group, variable support, script vs. script vars). Bru blocks and yaml sections are both mapped to it, so the existing variable logic serves both formats without yaml pretending to be Bru. This also resolves the `getAdditionalCollectionData` ToDo (§4).

---

## Step 1: Map descriptors (shared)

- In [external yamlFormat/interfaces.ts](shared/fileParsing/external/yamlFormat/interfaces.ts), replace `YamlMapMissingPropertyInfo` with:
    ```ts
    export interface YamlMapDescriptor {
        /** All keys defined in the map, including unknown ones. */
        definedKeys: { key: string; keyRange: Range; valueRange?: Range }[];
        expectedKeys: YamlExpectedKeyInfo[];
    }
    export interface YamlExpectedKeyInfo {
        key: string;
        isMandatory: boolean;
        valueKinds: ("string" | "boolean" | "number" | "map" | "sequence")[];
        allowedValues?: readonly string[];
    }
    ```
- Add an optional sink `mapDescriptors?: YamlMapDescriptor[]` to `CommonParsingArgs` ([internal interfaces.ts](shared/fileParsing/internal/yamlFormat/interfaces.ts)).
- New helper `yamlMaps/recordMapDescriptor.ts`. [getValidatedMapItems.ts](shared/fileParsing/internal/yamlFormat/yamlMaps/getValidatedMapItems.ts) calls it with the items from `getMapItems`.
    - `getMapItems` has to return the key ranges of _valid_ keys too. They already exist on the valid items; collect them into `definedKeys` together with `unknownKeys`.
    - `additionalAllowedKeys` count as expected keys. Callers can pass their kinds, e.g. `{ key, valueKinds }`.
    - `silentlyAllowedKeys` don't count. These are e.g. the request-type sections that don't match `info.type`, and those should stay hidden.
- **Enum values as a single source of truth:**
    - Extend `ExpectedKeys.scalars` ([getMapItems.ts](shared/fileParsing/internal/yamlFormat/yamlMaps/getMapItems.ts)) with `enumValues?: Record<string, readonly string[]>`. Keys listed there count as string keys.
    - `ValidatedMapItems` gets `getEnumValue<T>(key)`, which takes over the logic and error of [getTypedValueFromList.ts](shared/fileParsing/internal/yamlFormat/scalars/getTypedValueFromList.ts).
    - Migrate its ~15 callers, e.g. `parseFlatAuthMap`'s `enumKeys`, OAuth2, body/param/script/action/assertion/variable types, `info.type`, websocket message type. Delete `getTypedValueFromList` if nothing uses it afterwards.
- **Early exits:**
    - `tryToParseAuthTypeField` must call `recordMapDescriptor` with `{ type: enum AuthType, mandatory }` _before_ bailing out.
    - Same for [parseInfoFromYamlFile.ts](shared/fileParsing/external/yamlFormat/parseInfoFromYamlFile.ts), the other direct `getMapItems` user.
    - Review every other `return { errors }` that happens before a map's `getValidatedMapItems` call.
- **Remove `missingProperties`** (decided):
    - Drop it from `ParsedYamlMap` and from all parsers.
    - Update the affected tests in `shared` (~60 assertions). Where they check missing keys, assert on descriptors instead.
    - [checkAuthHasRequiredFields.ts](server/src/yamlFiles/diagnostics/checks/requestFiles/checkAuthHasRequiredFields.ts) is the only production user. [yamlFormatDiagnosticsProvider.ts](server/src/yamlFiles/yamlFormatDiagnosticsProvider.ts) collects descriptors for request files. The check finds the auth map's descriptor through the `definedKeys` entry whose `keyRange` equals `properties.type.keyRange`, and reports `expectedKeys − definedKeys`. That keeps today's behavior exactly, including the OAuth2/OAuth1 special cases.

## Step 2: Tolerant parsing and cursor context (shared)

- `parseDocumentIntoYamlMap` gets an option `continueOnSyntaxErrors`. With it, it keeps going with `document.contents`.
- The five `parse*File` functions get an optional `options?: { mapDescriptors?: YamlMapDescriptor[]; continueOnSyntaxErrors?: boolean }`, which is passed into `commonArgs`.
- New dispatcher `shared/fileParsing/external/yamlFormat/getYamlCursorContext.ts`, exported from `shared/index.ts`:
    - **Key position:** the text before the cursor matches `^\s*(-\s+)?[\w-]*$` and only whitespace follows it.
        - Patch the line: append `:` to the typed word, or insert the placeholder key `__bruAsCodeCompletion__:` at the cursor.
        - Parse it tolerantly, dispatching on `BrunoFileType`. Pick the descriptor that has a defined key on the cursor line.
        - Verified placements: a blank line in a map, at the top level, between keys, under an empty `auth:`, a new `- ` item, inside an item map, and after a `|-` scalar. Only invalid indentation fails, and then there are no completions.
    - **Value position:** `^\s*(-\s+)?([\w-]+):\s*(\S*)$`. Parse the unpatched text and pick the descriptor whose defined key on that line has the same name.
    - **Sequence-of-scalars value** (`- ` inside `info.tags`): the placeholder doesn't land in any descriptor. Use the key path to recognize this case.
    - The key path, e.g. `["info", "tags"]` (sequence indices dropped), comes from walking the patched AST with `visit` from `yaml`.
    - Returns one of:
        - `{ kind: "key", descriptor, replaceRange, indentation, path }`
        - `{ kind: "value", descriptor, keyInfo, replaceRange, path }`
        - `{ kind: "sequenceValue", replaceRange, path }`
        - `undefined`

## Step 3: Structural completions (server)

- New `server/src/yamlFiles/completions/handleCompletionRequest.ts`. It mirrors [bruFiles/completions/handleCompletionRequest.ts](server/src/bruFiles/completions/handleCompletionRequest.ts) and gets the item type from the collection cache.
- **Keys:**
    - Offer `expectedKeys` minus the other `definedKeys`.
    - Use the same sortText (`a_`/`b_`) and `optional` label detail as [getCompletionsForKeys.ts](server/src/bruFiles/completions/dictionaryBlocks/generic/getCompletionsForKeys.ts).
    - Insert text: scalar → `key: `; map → snippet `key:\n<indent+2>$0`; sequence → `key:\n<indent+2>- $0`. Mixed kinds (e.g. `auth`, `docs`, `message`, variable `value`) use the scalar form. Line breaks come from `docHelper.getMostUsedLineBreak()`.
- **Values:** `allowedValues`; `true`/`false` for boolean-only keys.
- **Path-specific values:**
    - `info.seq`: reuse [getSequenceValueCompletion.ts](server/src/bruFiles/shared/getSequenceValueCompletion.ts) and move it to `server/src/shared`.
    - `info.tags` items: reuse `getExistingRequestFileTags`. It is cache-based and works for any format.
    - Environment `extends`: reuse the value logic from `getCompletionsForPositionOutsideOfBlocks.ts` L141-225, extracted to `server/src/shared`.
- Add `case FileTypeByExtension.Yml` to the `onCompletion` switch in [server.ts](server/src/server.ts). Check whether `-` needs to be added to the trigger characters (currently `:`, space, `{`, …).

## Step 4: Variables (shared + server + client)

### Why not adapt yaml sections to `Block`s

The variable machinery only reads two things from a `Block`: `variableReferences`, and `name`, compared against lists of Bru block names to answer four questions:

- Which execution group is it in? ([getBlockRuntimeExecutionGroup.ts](shared/languageUtils/bruFormat/commonBlocks/generic/runtimeBehavior/getBlockRuntimeExecutionGroup.ts), `getBlocksWith{Earlier,Later}ExecutionGroups`)
- Does it support variables? (`getBlocksWithoutVariableSupport`)
- Is it a script vars section, which only writes variables, and which script does it belong to? (`getScriptBlockForVariableBlock` in [getAllVariableReferences.ts](server/src/bruFiles/shared/VariableReferences/getAllVariableReferences.ts))
- Is it a pre-request or post-response script? (scope selection in `getMatchingStaticScriptVariableReferences`)

`content` is never read. Fake `Block`s with Bru names for yaml would only exist to encode these facts, with placeholder `content` and `nameRange`, and the cache would store Bru block names for yaml files. So the facts become an explicit type instead.

### Format-neutral model (shared)

- New folder `shared/languageUtils/shared/variables/` (format-neutral, next to `bruFormat/`):
    ```ts
    export enum VariableScopeSectionKind {
        PreRequestScript,
        PostResponseScript,
        Tests,
        GrpcBeforeCallStartScript,
        GrpcBeforeMessageSendScript,
        GrpcAfterMessageReceiveScript,
        GrpcAfterCallEndScript,
        PreRequestVars,
        PostResponseVars,
        Assertions,
        Request, // url, headers, params, body, auth, …
        NoVariableSupport, // docs, meta/info, settings
    }
    export interface VariableScopeSection {
        kind: VariableScopeSectionKind;
        range: Range;
        variableReferences: BrunoVariableReference[];
    }
    ```
- Helpers that work on the kind, each mapping defined once:
    - `getSectionRuntimeExecutionGroup(kind)`, which replaces `getBlockRuntimeExecutionGroup`
    - `getSectionsWithEarlierExecutionGroups` / `…Later…`, which replace the block versions
    - `isCodeSection(kind)`, `hasVariableSupport(kind)`, `isScriptVarsSection(kind)`, `getScriptSectionForScriptVarsSection(kind)`
- Move the `{{\S+?}}` pattern from `getPatternForVarsReadReferenceInNonCodeBlock` here, since it serves both formats.
- Delete the old block-name helpers once nothing uses them. `parseBruFile` (uses `getBlocksWithoutVariableSupport`) and [getJsCodeBlocksFromFile.ts](shared/fileParsing/external/shared/codeBlocks/getJsCodeBlocksFromFile.ts) (uses `getBlockRuntimeExecutionGroup`) go through the Bru mapping below instead.

### Producers (shared)

- **Bru:** `shared/fileParsing/external/bruFormat/getVariableScopeSectionsFromBlocks.ts`, `Block[]` → `VariableScopeSection[]`.
    - The only place that maps Bru block names to kinds: script blocks, `vars:pre-request`/`vars:post-response`, `assert`, `docs`/`meta`/`settings` → `NoVariableSupport`, everything else → `Request`.
    - `range` is the block's `contentRange`. `variableReferences` are taken over from the parsed block.
- **Yaml:** `shared/fileParsing/external/yamlFormat/getVariableScopeSectionsFromYamlFile.ts`.
    - Scripts come from [getScriptBlocksFromYamlFile.ts](shared/fileParsing/external/yamlFormat/getScriptBlocksFromYamlFile.ts): kind by `ScriptType`, refs from `getBrunoVariableReferencesInCodeBlock`.
    - Read references `{{var}}`:
        - Walk all string scalars of the tolerant AST with `visit`.
        - Map the top-level path to a kind: `http`, `headers`, `params`, `body`, `auth` etc. → `Request`, `runtime.assertions` → `Assertions`, `docs`/`info`/`settings` → `NoVariableSupport` (no refs).
        - One section per mapped top-level value, so the cursor lookup finds the right one.
        - Ranges are only computed for single-line plain/quoted scalars and literal block scalars (`getBlockScalarContentRange`).
    - Write references:
        - `runtime.variables[].name` → `PreRequestVars`
        - `runtime.actions` that set a variable → `PostResponseVars`
        - Check both mappings against how Bruno converts these sections.
- **Dispatcher** `shared/fileParsing/external/shared/getVariableScopeSectionsFromFile.ts`: parses by format and returns the sections. Exported from `shared/index.ts`.

### Resolve §4 (shared + server)

- `AdditionalCollectionData` ([server/src/shared/interfaces.ts](server/src/shared/interfaces.ts)) becomes `{ reference: BrunoVariableReference; sectionKind: VariableScopeSectionKind }[]`.
- [getAdditionalCollectionData.ts](shared/fileSystemCache/internal/getAdditionalCollectionData.ts) uses the dispatcher for both formats. The provider's `getData` in [helpersProvider.ts](server/src/shared/helpersProvider.ts) receives sections, and `getAllVariablesFromBlocks` is replaced by a section equivalent.
- That gives yaml dynamic references from other files, and the cache no longer stores format-specific names.

### Server

- Move the format-neutral variable code from `server/src/bruFiles/` to `server/src/shared/variables/` and switch it to sections:
    - `BlockRequestWithAdditionalData<T extends Block>` becomes `VariableSectionRequest` with `file: { collection, allSections, sectionContainingPosition }`.
    - Affected: `getAllVariableReferences`, `getDynamicVariableReferencesWithinFile`, `getMatchingStaticScriptVariableReferences`, `getHoverForCodeBlock`, `getHoverForBrunoVariable`, `getCompletionsForCodeBlock`, and the read/write-variable part of `getCompletionsForNonCodeBlock`. Split that part off from the Bru block-specific completions.
    - Rename where the name says "block", e.g. `getHoverForCodeBlock` → `getHoverForVariableInCodeSection`.
- **Bru handlers** ([bruFiles/completions/handleCompletionRequest.ts](server/src/bruFiles/completions/handleCompletionRequest.ts), [bruFiles/hover/handleHoverRequest.ts](server/src/bruFiles/hover/handleHoverRequest.ts)) keep their `Block`s for Bru-specific features (dictionary keys, auth fields, tags in `meta`). For variables, they derive the sections with `getVariableScopeSectionsFromBlocks`.
- **Yaml handlers** find the section containing the position and call the same variable functions.
    - New `server/src/yamlFiles/hover/handleHoverRequest.ts` handles variables plus tag usages. Extract the tag table from [getHoverForNonCodeBlock.ts](server/src/bruFiles/hover/getHoverForNonCodeBlock.ts) into `server/src/shared`.
    - Add `case FileTypeByExtension.Yml` to `onHover`.
- Bru behavior has to stay exactly the same. The existing Bru completion and hover tests guard this and should only need mechanical changes to the arguments.

### Env names and client

- **Env-name bug (§8 [Check]):** `mapStaticEnvVariablesToCompletions` and `getHoverContentForStaticEnvVariables` hard-code `.bru`. Use the collection's format or `collection.getEnvironments()`.
- **Client:**
    - `provideTsLangCompletionItems.ts` (L80-102) only defers env-var completions inside `bru.getEnvVar("…")` to the server for Bru. Extend that to yaml.
    - `provideInfosOnHover.ts` (L64-70) always answers for yaml. Mirror the Bru handling so that server hovers for variables in scripts don't get duplicated or swallowed.

### Known limitations after implementing step 4

- **Quote handling for `{{` completions:** the shared `getCompletionsForReadOnlyVariablesInNonCodeSection` takes `nonVariableNameCharacters`. The yaml handler passes `"` and `'`, so the closing quote of a string is not treated as part of the variable name. Bru uses the unchanged pattern.
- **Read references in yaml** are only found in single-line plain/quoted scalars and in block scalars. Multi-line plain/quoted scalars are skipped, and so are scripts that are not literal block scalars. Variable values (`runtime.variables[].value`) are not searched for `{{var}}`.
- **Unsupported yaml sections:** environment and app files get no variable sections. The `config` and `extensions` sections of collection settings count as `NoVariableSupport`.
- **No tests yet** for the yaml branch of `getAdditionalCollectionData` (mapping a directory to the folder/collection settings file type).

## Step 5: Optional, cheap via descriptors

A generic key hover: expected type, mandatory/optional, allowed values. Bru doesn't have this, so it's beyond parity. Only do it if wanted.

## Tests

- Inline yaml strings only, never files from `samples/`. Helpers go after the tests.
- Reuse and extend `shared/_testingUtils/`, e.g. a helper that parses a yaml string with a descriptor sink.
- **Shared:**
    - `getValidatedMapItems.test.ts`: descriptor, enum values, unknown keys
    - the auth discriminator descriptor
    - tolerant parsing
    - `getYamlCursorContext.test.ts` with all placements from Step 2
    - the section helpers (execution groups, variable support, script vars ↔ script)
    - `getVariableScopeSectionsFromBlocks`: kind mapping for every Bru block name
    - `getVariableScopeSectionsFromYamlFile`: kinds, ranges and refs
    - yaml additional data
- **Server:** yaml completion and hover handler tests modelled on the Bru handler tests, plus the rewritten `checkAuthHasRequiredFields` tests in the existing `yamlFormatDiagnosticsProvider.requestFiles.test.ts`.

## Docs

- Update `format-specific-handling.md`: remove or adjust §4, §8 bullet 2 and the env-name [Check].
- **CHANGELOG:** no entry. Everything here only affects yaml collections, which are behind the `yamlCollectionSupport` toggle. The env-name fix is only visible in yaml collections, too. Switching the Bru variable features to `VariableScopeSection` is a pure refactoring. If it changes Bru behavior after all, that's a bug to fix, not something to document.

## Verification

- Run `npm run check-types` and the jest suites for `shared`, `server` and `client`.
- Manually test in the extension development host with `yamlCollectionSupport` enabled:
    - In a yaml request file:
        - key completions on an empty line at the top level, in `http`, in a new `headers` item and in a half-typed key
        - `auth:` → `type`, then `type: ` → auth types
        - `method: `
        - `{{` in `url`
        - `bru.getEnvVar("` in a `code: |` script
        - `seq: `
        - a `tags` item
    - Hover over `{{var}}`, a script variable and a tag.
    - Check that yaml diagnostics are unchanged, especially the auth missing-keys warning.
    - In a bru collection, check that variable completions and hovers still work: script vars blocks, script blocks, `{{var}}` in `headers` and references from a folder's `folder.bru`.
