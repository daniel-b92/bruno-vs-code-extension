## About the project

The goal is to provide a VS Code extension that allows working with `Bruno` files like working with code, including intellisense. `Bruno` is an open source API client, see [online docs](https://docs.usebruno.com/) for more infos.

**Disclaimer: All Bruno names, brands, trademarks, service marks and logos are the property of Bruno. This extension is not the official VS Code extension but instead a non-official one. The official extension can be found [here](https://marketplace.visualstudio.com/items?itemName=bruno-api-client.bruno).**


The `Bruno` desktop app (see [downloads](https://www.usebruno.com/downloads)) and the official [VS Code extension](https://marketplace.visualstudio.com/items?itemName=bruno-api-client.bruno) both provide a custom UI for navigating and working with `Bruno` files.


However, I personally prefer working on API tests in a more code like manner with VS Code as my Go-To IDE. That's why I started developing this extension.

## Main Features

The main features of the extension are

- a collection explorer
- a test runner (for executing tests via the [Bruno CLI](https://www.npmjs.com/package/@usebruno/cli))
- language features (for providing some intellisense when editing `Bruno` files)

## Using the extension

### Getting started

For getting the most out of the extension, please follow these steps when installing it:

- If your collection is in a git repository, add the entry `**/__temp_bru_reference.js` to your gitignore file.
  - The extension will temporarily create a file with this name for providing the Javascript intellisense. So the gitignore advice is just to make life easier, since this file is only used internally by the extension (it should usually also delete it, when not needed anymore, but you would probably stumble over it occasionally anyway).
- After installing the extension, you may need to trigger a restart of the extension host for the full intellisense to work (you can do this by opening the command palette (Ctrl + Shift + p) and executing the command for restarting the extension host).


### Improving intellisense
- If you use the `test` and the `expect` functions in your response validations, it's helpful to add the npm packages 
  - [@types/mocha](https://www.npmjs.com/package/@types/mocha) and
  - [@types/chai](https://www.npmjs.com/package/@types/chai)
  
  as dev dependencies for your collection. That will enable proper intellisense for these functions. Also consider adding type definitions for other inbuilt libraries you use within your tests (e.g. `moment`).

## Contributing

### Getting started

For contributing, checkout the github repository https://github.com/daniel-b92/bruno-vs-code-extension.
You need to have `npm`  and `node js` installed.
Run the following command for installing all dependencies:

```bash
npm install
```

If you want to make changes to the Typescript language service plugin used by the extension, see [Readme](./src/tsPlugin/README.md) for more infos.