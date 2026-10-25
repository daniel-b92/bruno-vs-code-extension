# Evaluation: replacing temporary JS files with the TS language service plugin

## Verdict

Feasible without rewriting large parts of the language service. Everything needed is a host-level override of the kind the plugin already uses for Yaml masking (`getScriptSnapshot` / `getScriptVersion` on `info.languageServiceHost`). Experiments against the plugin's own TypeScript (6.0.3) confirmed all core building blocks.

VS Code's TS extension already serves hovers and completions for the plugin languages (`bru`, `yaml`). The plugin currently switches them off on purpose (`tsPlugin/src/languageService/navigationOverrides.ts`). Once the plugin produces good results, the client-side providers and the whole queue/sync machinery could go.

## Why the temp JS files exist

Known reasons:

1. Intellisense for the Bruno runtime types (`bru`, `req`, `res`, `test`, `expect`).
2. Intellisense for imported js/ts files (import paths are relative to the collection root in Bruno).

Additional reasons found:

3. **`.bru` files are parsed as TypeScript, not JavaScript.** VS Code sends no JS script kind for `bru`, so tsserver falls back to TS. Measured on today's setup:
    - JSDoc types are ignored: `/** @type {{a: number}} */ const typed = …` hovers as `any`.
    - `require()` isn't treated as an import: `const lib = require(…)` is `any`, and `2591 Cannot find name 'require'` is reported (worked around by the `"require"` filter in `tsPlugin/src/diagnostics/filterDefaultDiagnostics.ts`).
    - This holds even with a correct path, so imports are broken by the parse mode, not only by root-relative paths.
4. **Non-code content of a `.bru` file is parsed as code.** `meta`, `request`, `pre` etc. become bogus identifiers and syntax errors. The temp file contains only the code blocks.
5. **Each block gets its own scope and context.** Each block is wrapped in its own `async` function (`mapBlockNameToJsFileLine.ts`), giving:
    - a separate scope per block, as at runtime,
    - valid `await`,
    - typed shadowing parameters (`req` / `res` are `undefined` where Bruno doesn't provide them; gRPC blocks get their own `bru` variants, see `getTempJsFileContent.ts`).
6. **The runtime definitions need the collection's `node_modules`.** They contain `require("chai")` / `require("mocha")`, which resolve relative to the containing file. At the collection root, the temp file finds the collection's `@types/chai` and `@types/mocha`. Typings shipped inside the plugin folder would resolve against the extension's install location instead.
7. **The collection's `tsconfig.json` applies.** A temp file at the root falls under the collection's `tsconfig`/`jsconfig` (`strict`, `checkJs`, `types`). A `.bru` file in tsserver most likely lands in an inferred project with default settings. (Not verified in a real tsserver session.)
8. **Plain `.js` files, including those in `additionalContextRoots`.** For these, the temp file adds `globalThis.bru = …` etc. These files are never deleted, because the plugin only suppresses runtime-name diagnostics inside collections (`activateLanguageFeatures.ts`, `handleOpeningOfJsDocument` / `deleteNonMandatoryTempJsFiles`).

## What a plugin-based replacement needs

| Building block                   | Mechanism                                                                                                                                                   | Experiment                                                                                    |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| JS semantics for `.bru` / `.yml` | override `host.getScriptKind` → `ScriptKind.JS` (~10 lines)                                                                                                 | JSDoc types and `require` work                                                                |
| Root-relative imports            | override `host.resolveModuleNameLiterals` for `.bru` / `.yml` (~30 lines)                                                                                   | `lib.` suggests `helper`                                                                      |
| Runtime types                    | virtual `<collectionRoot>/__bruno_runtime.d.ts`: add in `getScriptFileNames`, serve via `getScriptSnapshot` / `getScriptVersion` / `fileExists` (~60 lines) | hover shows `getEnvVar(name: string): string`                                                 |
| Clean `.bru` parse               | position-preserving masking, same idea as `maskYamlCollectionFileContent`, reusing `getCodeBlockIndizesForBruFile`                                          | no syntax errors                                                                              |
| Per-block context                | write wrappers like `__pre(async res=>{` into the masked area in front of `{`, typed by contextual callbacks declared in the virtual `.d.ts`                | `res: undefined` in pre-request, `res.status: number` in `tests`, `await` OK, separate scopes |

Masking keeps every offset unchanged, so no position mapping is needed (`getPositionWithinTempJsFile`, `mapToRangeWithinSourceFile`).

### What could be deleted

The queue, sync logic, file creation/deletion and the temp-file paths in the four client providers (completion, hover, signature help, definitions) — well over 1,000 lines. Several diagnostic workarounds too (7006/7031/18046, the `require` filter, probably the runtime-name filter).

### What it costs

- ~300 lines of new plugin logic.
- ~950 lines of runtime definitions move from the client into the plugin. This is data, not logic, but it has to be converted to `.d.ts` style (`declare const bru: …`), because the current JS `const bru = {…}` plus `require` would make the file a module.

## Risks and open points

- **Virtual files have no `ScriptInfo` in tsserver.** Results pointing into the virtual file (definitions, references, `relatedInformation`) must keep being filtered. The temp-file-name filters exist already and would only need the new name.
- **Wrappers need room.** `tests {` leaves only 6 characters before the `{`; the first experiment overwrote the previous block's `}`. Real files usually have enough masked content in front, but a fallback to a plain `{}` block (as Yaml does today) is required. A `;` is also needed against ASI: `__pre(…)\n(async…)` was parsed as a call.
- **Module resolution cache.** Custom resolution for `.bru` files bypasses tsserver's invalidation of failed lookups, so a newly created helper file may only be picked up after the next edit.
- **Several collections in one inferred project.** Would create duplicate globals; use `declare var` / interface merging, or one virtual file per project.
- **`tsconfig` for `.bru` files.** Inferred-project behaviour (point 7) must be confirmed. The plugin's `getExternalFiles` hook could add the files to the configured project if needed.
- **Extra information for the plugin:** `additionalContextRoots` from `bruno.json`, and the request type (gRPC or not) from the file content.
- **TypeScript 7 (native).** As far as known, it doesn't support tsserver plugins (yet). The temp-file approach only uses VS Code's JS features and would keep working. Moving more into the plugin increases this dependency, although diagnostics, rename, code fixes and formatting already rely on it.

## Suggested order

Each step can ship on its own:

1. `getScriptKind` → JS plus root-relative resolution. Low risk; makes diagnostics consistent with hovers immediately.
2. Virtual runtime typings.
3. `.bru` masking with block wrappers.
4. Enable hover, completions and signature help in the plugin, then delete the client providers and the temp-JS machinery.

## Implementation status (steps 1–3)

Steps 1 to 3 are implemented in `tsPlugin`. Verified with the plugin's jest tests and a smoke test against a real `tsserver` (inferred project, `.bru` and `.js` files in a collection).

### Deviations from the evaluation above

- **Runtime definitions are a virtual JS file, not a `.d.ts`.** `<collectionRoot>/__bruno_runtime_definitions.js` keeps the existing JSDoc definitions (declaration emit lost the docs and typedefs). To keep the file a script (so that `var bru` and the typedefs are global), `require("chai")` / `require("mocha")` became `typeof import("chai").expect` / `typeof import("mocha").test`. The definitions were copied to `tsPlugin/src/runtimeDefinitions/`, so the client still has its own copy until step 4.
- **Virtual files need a `ScriptInfo` in a real tsserver.** Without it, tsserver fails with a `Debug Failure` in `ProjectService.setDocument`. The plugin registers one via `projectService.getOrCreateScriptInfoForNormalizedPath` and attaches it to the project (otherwise it is removed again as an orphan).
- **Wrappers are arrow functions, not `__pre(async res=>{` callbacks.** A callback needs a closing `)` after the block's `}`, but there is no free character there. `;async(/**@type{undefined}*/res)=>{` works as an expression statement without a closer. The JSDoc comment can be spread over several lines, so the tokens fit into more places. Tokens are placed as late as possible; the first token of a line is moved to column 0, because the TS indenter indents relative to the line the wrapper starts on.
- **Fallback ladder for blocks without enough room in front:** typed parameters → untyped `;async()=>{` → `;{` → `{`.
- **gRPC `bru` variants are global typedefs** in the runtime file (`BruForPreRequestGrpc`, `BruForPostResponseGrpc`). The request type is detected from `type: grpc` in `meta` or from a `script:grpc:*` block.
- **Runtime-name diagnostic filter narrowed instead of removed.** Names like `res` are only filtered for "cannot find name" (2304, 2582). A full name filter would hide the typed `'res' is possibly 'undefined'` (18048). 1108 / 1375 / 1378 are filtered for code-block files (fallback blocks without a function wrapper).
- **Formatting of `.bru` files by the plugin is switched off** (like Yaml), because edits would be computed on the masked content.

### Not covered yet

- **Yaml scripts still use plain `{}` blocks.** No async function wrapper and no shadowed `req` / `res` / gRPC `bru`. Needs a wrapper placement for `maskYamlCollectionFileContent` (the opening bracket position is flexible there) and the request type from `info.type`.
- **Typed shadowing only applies if there is room.** A block directly after another code block (e.g. `script:post-response` right after `script:pre-request`, or `tests` after a script) often only has its own header line free. It then falls back to an untyped wrapper or a plain block: `req` / `res` are not shadowed and (for `tests`) top-level `await` relies on the diagnostic filter. Possible improvements: none known without inserting text; could be accepted as a limitation.
- **Indentation in plain-block fallbacks.** The `{` is not at column 0, so refactorings that insert lines (e.g. "Extract to constant") indent relative to the `{`.
- **Stale collection detection.** Collection roots are cached per directory and only recomputed when the project's root file list changes. A `bruno.json` that is created while files are already open is picked up after the next change of the file list.
- **Projects without `allowJs`.** The runtime file is JS. In a configured project that doesn't allow JS, the file is not part of the program, so the runtime objects stay untyped there.
- **Several collections in one inferred project.** Works (tested), but the duplicate global declarations are only silently ignored: the first declaration wins. A collection with different `@types/chai` / `@types/mocha` versions gets the types of the first one.

## Implementation status (step 4)

Step 4 is implemented. Verified with the plugin's jest tests, the full jest run, `npm run check-types` and a smoke test against a real `tsserver` (inferred projects, `.bru` and `.js` files, configuration passed via `configurePlugin`).

### What changed

- **Plugin: hover, completions and signature help** are provided for `.bru` / `.yml` files (`navigationOverrides.ts`), but only for positions within code blocks (`isPositionWithinCode`). Definitions, references and rename already worked.
- **Names of variables are left to the extension.** Within the first string argument of `bru.getEnvVar(...)` & co. (`inbuiltFunctionParameters.ts`), hovers and completions are not provided by the plugin, since the language server provides them (otherwise the content would be shown twice). The list of function names is copied into the plugin (`getNamesForInbuiltFunctionsWithVariableName`, kept in sync with `InbuiltFunctionName` by a test).
- **Completion filtering for code blocks:** no auto imports (`hasAction`; the option `includeCompletionsForModuleExports` is switched off as well), since selecting them would insert an `import` outside of the code block. The gRPC typedefs (`BruForPreRequestGrpc`, `BruForPostResponseGrpc`) are hidden (they show up in type positions, e.g. `/** @type {…} */`). The wrapper parameters `req` / `res` that shadow the global objects are hidden, but parameters with the same name that are declared within the code are still suggested.
- **`additionalContextRoots`** are passed by the client via the plugin configuration (`additionalContextRoots`, absolute paths), because a JS file outside of a collection cannot be mapped to its collections by the plugin. `CollectionItemProvider` got `subscribeToAdditionalContextRootChanges`; the client re-sends the configuration after the initial cache load, on item updates and when the roots of a collection change. The runtime definitions for such a file are located in the context root folder, like the temp file used to be.
- **Plugin configuration is also read from `info.config`.** If `configurePlugin` is called before a project exists (which is the case when the VS Code extension configures the plugin on startup), tsserver passes the configuration via `info.config` of `create` and never calls `onConfigurationChanged`.
- **Temp files of older versions are ignored by the plugin** (removed from the root files of the project), since they declare the runtime objects a second time. They are not deleted by the extension. `getPathsToIgnoreForCollections` still ignores them in the cache.
- **Client:** the four providers (completion, hover, signature help, definitions), the update queue, the temp file creation / deletion, `TempJsFilesProvider`, `getTemporaryJsFileNameInFolder` and the client copy of the runtime definitions were deleted. `activateLanguageFeatures` only configures the plugin, loads the cache for relevant files, shows the warning for `.bru` files outside of collections and registers the line comment commands. Generated `tsconfig.json` files no longer exclude the temp file.

- **Completions for relative `require` paths are computed by the plugin** (`relativeModulePathCompletions.ts`). The Typescript server derives the directory for path completions from the path of the source file (`getDirectoryPath(sourceFile.path)`), not from the module resolution of the host, so `require("./` would list the folder of the `.bru` file. The plugin lists the files (`.js`, `.cjs`, `.json`, without the extension for `.js`) and folders (except `node_modules` and hidden ones) relative to the collection root instead. Paths to packages (`require("lodash")`) are still provided by the Typescript server. `additionalContextRoots` are not considered for these paths.
- **Collection files are part of configured projects** (point 7 above, `includeCollectionFilesInConfiguredProjects.ts`). Confirmed with a real `tsserver`: without further changes, `.bru` / `.yml` files land in an inferred project, and a collection `tsconfig.json` without any `.js` files reports "No inputs were found in config file" (18003), since the temp file at the collection root is gone. The plugin registers `.bru` and `.yml` as `extraFileExtensions` (script kind JS) via `projectService.setHostConfiguration`, so they match the `include` paths of configured projects that allow JS (`allowJs`). Setting the extensions reloads all projects, so it is done once per project service and deferred with `serverHost.setTimeout` (a synchronous reload within `create` would interfere with the project that is still being loaded). The project is first loaded without the files (and the error is reported briefly), then reloaded with them. Extensions registered by other plugins are kept. Projects without `allowJs` keep the previous behavior.

### Differences in behavior to the temp-file based implementation

- Hovers of the runtime objects show e.g. `(parameter) res: undefined` in pre-request blocks (the shadowing parameter) instead of nothing.
- Auto imports are not suggested in `.bru` files anymore.
- Completions and hovers for the code of Yaml files only work while Yaml collection support is enabled (as before for the extension's providers).

### Still open

- **Not verified:** behavior inside VS Code itself (only a standalone `tsserver` was driven; e.g. whether the diagnostics of an open file are refreshed after the deferred reload of the projects) and Windows paths (the configured roots are normalized to forward slashes, the comparison is case sensitive).
- **Leftover temp files** are only ignored, not deleted.
- **`additionalContextRoots` in the plugin** have no effect for projects that do not get the configuration (e.g. when the plugin is used standalone without the extension).

## Experiment notes

Both experiments used `ts.createLanguageService` with a custom host and TypeScript 6.0.3 from `tsPlugin/node_modules`. They are not part of the repo. The setups were:

- **Experiment 1:** a `.bru` file with a `require` of a helper module, a JSDoc-typed variable and a `bru.getEnvVar` call. Four variants: default; plus `getScriptKind` JS; plus root-relative `resolveModuleNameLiterals`; plus masked non-code content and a virtual global `.d.ts`.
- **Experiment 2:** a generated position-preserving mask with `__pre(async res=>{…})` and `(async()=>{…})` wrappers, and a virtual `.d.ts` declaring `res` and the callback helpers.
