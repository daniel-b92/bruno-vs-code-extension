## About the project

The VS Code extension allows working with `.bru` files like working with code. The main focus is on providing great intellisense when working with `.bru` files or `.js` files in `Bruno` collections. `Bruno` is an open source API client, see [online docs](https://docs.usebruno.com/) for more infos.

**Disclaimer: All Bruno names, brands, trademarks, service marks and logos are the property of Bruno. This extension is not the official VS Code extension but instead a non-official one. The official extension can be found [here](https://marketplace.visualstudio.com/items?itemName=bruno-api-client.bruno).**

## Main Features

The main features of the extension are

- a collection explorer for creating/modifying/deleting request files and folders within collections
- a test runner (for executing tests via the [Bruno CLI](https://www.npmjs.com/package/@usebruno/cli))
- language features that provide some intellisense when editing `.bru` files, e.g. providing suggestions when typing in code blocks.
  - There also is a formatter included (curently only for formatting code blocks).

![VsCodeExtensionLanguageFeatures](https://github.com/user-attachments/assets/c558b1bf-5a0a-45c0-bd03-eea25728edec)


## Using the extension

### Getting started

For getting the most out of the extension, please follow these steps when installing it:

- If you already have an extension installed for working with `.bru` files (like e.g. the official [Bruno](https://marketplace.visualstudio.com/items?itemName=bruno-api-client.bruno) extension):
  - Please uninstall the other extension. Otherwise you may run into unexpected issues due to incompatibilities.
- Install `node js` and `npm`, if you haven't already.
- If your collection is in a git repository, add the entry `**/__temp_bru_reference.js` to your gitignore file.
  - The extension will sometimes temporarily create a file with this name for providing the Javascript intellisense.

### Improving intellisense
- You can improve intellisense by adding type definitions as dev dependencies for all inbuilt libraries from `bruno` that you use:
  - Most importantly for [Mocha](https://www.npmjs.com/package/@types/mocha) (intellisense for `test('description', function() {...})`) and [Chai](https://www.npmjs.com/package/@types/chai) (intellisense for `expect` validations).
  - Further inbuilt libraries that you use (e.g. `axios` or `moment`).
- Add typings via JSDoc in your code blocks and Javascript scripts, see https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html.
- If you have defined a `tsconfig.json` for your collection, you can e.g. activate type checking for your Javascript files or enable the `strict` type checking mode, see https://www.typescriptlang.org/tsconfig/ for more infos.

## Contributing

### Getting started

For contributing, checkout the github repository https://github.com/daniel-b92/bruno-vs-code-extension.
You need to have `node js` and `npm` installed.
Run the following command for installing all dependencies:

```bash
npm install
```

If you want to make changes to the Typescript language service plugin used by the extension, see [Readme](./src/tsPlugin/README.md) for more infos.
