## About the package

This directory provides an `npm` package for a Typescript language service plugin, that allows the Typescript server to handle code blocks from `Bruno` files just like real Javascript code. `Bruno` is an open source API client, see [online docs](https://docs.usebruno.com/) for more infos.

**Disclaimer: All Bruno names, brands, trademarks, service marks and logos are the property of Bruno.**

## Main Features

Only some of the intellisense features for `Bruno` files are provided by this npm package. For a fuller set of intellisense features, you can use the VS Code extension, that is built from the root folder of this git repository.

## Debugging

For using the local TS plugin within the VS Code extension, please follow these steps:
    - Replace the `name` in the base [package.json](../../package.json) for the `typescriptServerPlugins` contibution field with the name `typescript-for-bruno`.
    - In the base [tsconfig.json](../../tsconfig.json) replace the value for the `plugins` field with the commented out plugins value.
    - Use the launch configuration `Run Extension With local TS plugin` for launching the extension