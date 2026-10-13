# Diagnostics and renaming for code blocks in Yaml collection files

Goal: provide TS diagnostics and renaming for JS code inside Yaml collection files (`runtime.scripts[].code` in request files, `request.scripts[].code` in `folder.yml` / `opencollection.yml`), similar to what already works for `.bru` files.

Status: implemented in [maskYamlFileContent.ts](tsPlugin/src/yamlFiles/maskYamlFileContent.ts) and [tsPlugin/src/index.ts](tsPlugin/src/index.ts) (`maskYamlFilesForTypescriptServer`).

Starting point: adding `yaml` to the `languages` of the `typescriptServerPlugins` contribution in [package.json](package.json). This makes VS Code send `yaml` documents to the TS server, which parses them like Typescript files (unknown file extensions fall back to `ScriptKind.TS`).

## Why filtering diagnostics (like for Bru) is not enough

In a `.bru` file, the TS parser sees every code block as a real `{ … }` block (e.g. `tests { … }` is parsed as a label/expression followed by a block). The block keeps the code scoped and walls it off from the surrounding Bru syntax, so filtering diagnostics by location (see `filterDefaultDiagnostics` in [tsPlugin/src/index.ts](tsPlugin/src/index.ts)) is sufficient.

In a Yaml file, all code ends up at the top level of a single TS script, and the surrounding Yaml changes what the code means. A location-based filter cannot fix that. The issues below were reproduced by running sample Yaml content through the TypeScript compiler / language service.

### 1. False errors on the first line of every block

`code: |-` is parsed as the label `code` followed by the operators `|` and `-`, which are applied to the first line of the script:

- If the first statement is a declaration (`const x = 1;`), TS reports `Expression expected` on that line. The error lies inside the code block's range, so a location filter keeps it.
- If the first statement is an expression, it is silently negated (`-test(...)`).

### 2. No scoping

- All blocks within a file share one scope.
- Yaml files are not modules, so the blocks also share the global scope with the code blocks of every other Yaml file in the same TS project.

Consequences:

- Declaring `const x` in a `before-request` script and in a `tests` script results in `Cannot redeclare block-scoped variable 'x'` in both blocks **and** in other files declaring `x`.
- Real `Cannot find name` errors go missing when one block uses a variable that is only declared in another block (or another file).

### 3. Renaming can corrupt the Yaml content

Unquoted Yaml values are parsed as identifier references. Renaming a script variable called `json` returned the following rename locations:

```text
/a.ts line 3  "        type: json"          <- Yaml value
/a.ts line 8  "const json = { a: 1 };"
/a.ts line 9  "bru.setVar("a", json);"
/b.ts line 5  "const other = json;"         <- different request file
```

So renaming also changes identically named variables in other blocks and other request files, and rewrites Yaml values. Renaming only appears to work when the name occurs nowhere else.

### 4. Yaml content can swallow code blocks

Some Yaml content changes how everything after it is parsed:

- A backtick (e.g. in `docs`, a text body or a description) starts a template literal that may run to the end of the file.
- Values like `class`, `function` or `import` start declarations that consume the following tokens.
- XML bodies (`<foo>…`) are parsed as type assertions.

### 5. `yaml` is not an extension-owned language id

Unlike `bru`, the language id `yaml` is shared by all Yaml files in the workspace (CI configs, docker-compose, Kubernetes manifests, …). All of them are sent to the TS server once `yaml` is registered for the plugin:

- `filterDefaultDiagnostics` passes diagnostics for files that are neither `.bru` nor `.js` through unfiltered, so these files would show TS errors.
- Completions and hovers are only suppressed for `.bru` files. Yaml files would therefore get TS completions / hovers everywhere, and Yaml collection files would get them twice inside code blocks (the client already provides them via the temp JS file).
- Other TS features (outline, folding, document highlights, quick fixes, …) also run on these files.

## Suggested approach: mask Yaml files in the TS plugin

Instead of filtering what the TS server returns, change what it sees. The plugin wraps `info.languageServiceHost.getScriptSnapshot` and returns a masked text for `.yml` / `.yaml` files. This is the same technique that e.g. Volar uses for its Vue TS plugin (decorating the language service host).

### Masked text

- **Same length, all line breaks kept** (including `\r` for CRLF). Offsets and line/character positions stay identical to the real document, so diagnostics, rename locations, definitions etc. need no mapping.
- **Everything outside script contents is replaced by spaces.** Only the content of `code` fields that are literal block scalars (`code: |`, `|-`, `|+`) stays. This is the same restriction as for the temp JS file (see [getScriptBlocksFromYamlFile.ts](shared/fileParsing/external/yamlFormat/getScriptBlocksFromYamlFile.ts)), because only for this scalar style the raw text equals the code. This fixes issues 1, 3 and 4.
- **Each script is wrapped in a block** to get the same scoping as for Bru files (fixes issue 2):
    - The `{` is written into the blanked space before the content (e.g. where `code: |-` was).
    - The `}` is written into the next blanked non-line-break character after the content (e.g. the indentation or key of the following line). If there is none (the script is at the end of the file), it is appended at the end of the text. Appending does not shift any existing positions.
    - Not implemented (yet): a function wrapper (e.g. `(async () => {` … `})()`) could be used instead of a plain block, since Bruno executes the scripts within an async function. That would make top-level `return` / `await` valid. The line containing `code: |-` usually has enough free space for this. This should only be done if it is also done for Bru files, to keep both formats consistent.
- **Yaml files outside of a Bruno collection are masked completely** (all spaces), so the TS server returns no diagnostics, outline, hovers, … for them (issue 5). Completions still need to be suppressed explicitly, because TS offers global completions even at blank positions.

### Snapshot details

- The masked snapshot's `getChangeRange` returns `undefined`, so the TS server reparses the file completely instead of applying incremental changes based on the real text. This should be cheap for request files.
- The masking result can be cached per file name and script version (`info.languageServiceHost.getScriptVersion`) to avoid recomputing it for every request.

### Finding script contents in the plugin

The plugin is a standalone npm package and cannot import from `shared/`. It therefore depends on the `yaml` package itself and locates `runtime.scripts[].code` (request files) and `request.scripts[].code` (folder / collection settings files) via the parsed document.

Only `.yml` files inside a collection whose root contains an `opencollection.yml` are treated as collection files, since Yaml collections always use this extension. All other `.yml` / `.yaml` files (including Yaml files inside Bru collections) are masked completely.

### Behaviour of the other plugin overrides

Once the masked text is in place, Yaml request files can mostly be treated like Bru files:

- Diagnostics: apply the existing Bru filters (inbuilt runtime names like `bru` / `req` / `res`, TS-only codes `7006`, `7031`, `18046`, and the suggestion diagnostic codes filtered for Bru).
- Completions and hovers: return `undefined` for Yaml files (like for `.bru` files), since the client provides them via the temp JS file.
- Rename, references, definitions: keep the existing filtering of results located in the temp JS file (`__temp_bru_reference`).

The checks in the plugin that are currently based on `isBrunoFile` (only `.bru`) need to distinguish between "Bru file", "Yaml file inside a collection" and "any other file".

## Open points

- Quick fixes / refactorings that insert code at the top of the file (e.g. adding an import) would insert JS into the Yaml content. This already applies to Bru files today and could be addressed later by filtering code fixes for positions outside of code blocks.
- The change requires a new release of the plugin's npm package before it takes effect in the published extension.
