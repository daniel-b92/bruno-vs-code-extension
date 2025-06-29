## About the project

The goal is to provide a VS Code extension that allows working with `Bruno` files like working with code, including features like intellisense. `Bruno` is an open source API client, see [online docs](https://docs.usebruno.com/) for more infos.

**Disclaimer: All Bruno names, brands, trademarks, service marks and logos are the property of Bruno. This extension is not the official VS Code extension but instead a non-official one. The official extension can be found [here](https://marketplace.visualstudio.com/items?itemName=bruno-api-client.bruno).**

## Main Features

The main features of the extension are

- a collection explorer for creating/modifying/deleting request files and folders within collections
- a test runner (for executing tests via the [Bruno CLI](https://www.npmjs.com/package/@usebruno/cli))
- language features that provide some intellisense when editing `.bru` files, e.g. providing suggestions when typing in code blocks.

![VsCodeExtensionLanguageFeatures](https://github.com/user-attachments/assets/c558b1bf-5a0a-45c0-bd03-eea25728edec)


## Using the extension

### Getting started

For getting the most out of the extension, please follow these steps when installing it:

- Install `node js` and `npm`, if you haven't already.
- If your collection is in a git repository, add the entry `**/__temp_bru_reference.js` to your gitignore file.
  - The extension will sometimes temporarily create a file with this name for providing the Javascript intellisense.
- After installing the extension, you may need to trigger a restart of the extension host for the full intellisense to work (you can do this by opening the command palette (Ctrl + Shift + p) and executing the command for restarting the extension host).


### Improving intellisense
- You can improve intellisense by adding type definitions as dev dependencies for all inbuilt libraries from `bruno` you use within your collection (e.g. `axios` or `moment`).
- Add typings via JSDoc in your code blocks and Javascript scripts, see https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html

## Contributing

### Getting started

For contributing, checkout the github repository https://github.com/daniel-b92/bruno-vs-code-extension.
You need to have `node js` and `npm` installed.
Run the following command for installing all dependencies:

```bash
npm install
```

If you want to make changes to the Typescript language service plugin used by the extension, see [Readme](./src/tsPlugin/README.md) for more infos.
