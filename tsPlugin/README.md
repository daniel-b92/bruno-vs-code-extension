## About the package

This directory provides an `npm` package for a Typescript language service plugin, that allows the Typescript server to handle code blocks from `Bruno` files just like real Javascript code. `Bruno` is an open source API client, see [online docs](https://docs.usebruno.com/) for more infos.

**Disclaimer: All Bruno names, brands, trademarks, service marks and logos are the property of Bruno.**

## Main Features

Only some of the intellisense features for `Bruno` files are provided by this npm package. For a fuller set of intellisense features, you can use the VS Code extension, that is built from the root folder of this git repository.

The code blocks are analyzed as follows:

- Only the code blocks of `.bru` files (and the scripts of Yaml collection files) are seen by the Typescript server. All other content is replaced by spaces, so that positions in the file stay the same.
- Each code block of a `.bru` file is wrapped in an `async` arrow function by overwriting the characters in front of the opening bracket. This makes `await` and `return` available at the top level and scopes declarations per block. If the block is preceded by too little content, a plain block is used instead.
- Hovers, completions and signature help are only provided within code blocks. Completions that would insert an `import` or `require` statement are not offered in `.bru` files, since they would be inserted outside of the code blocks.
- The objects that `Bruno` provides at runtime (`bru`, `req`, `res`, `test`, `expect`) are declared in a virtual file in the root folder of each collection. `chai` and `mocha` are resolved from the `node_modules` of the collection.

## Debugging

For using the local TS plugin within the VS Code extension, please follow these steps:

- Replace the `name` in the base [package.json](../package.json) for the `typescriptServerPlugins` contibution field with the name `typescript-for-bruno`.
- Use the launch configuration `Run Extension With local TS plugin` for launching the extension

## Configuration

Scripts within Yaml collection files are only handled, if the plugin is configured with `{ "yamlCollectionSupport": true }` (e.g. via the `configurePlugin` function of the API of the VS Code Typescript extension). Otherwise, the Typescript server does not see any content of Yaml files.

Javascript files within the additional context roots of a collection (`scripts.additionalContextRoots` in `bruno.json`) can also use the objects that `Bruno` provides at runtime. The plugin does not read the setting itself, so the absolute paths of these folders have to be passed with the configuration option `additionalContextRoots` (e.g. `{ "additionalContextRoots": ["/path/to/shared/scripts"] }`).
