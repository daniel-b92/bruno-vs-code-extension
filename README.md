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

## Contributing

You need to have `npm` installed.
Run the following command for installing all dependencies:

```bash
npm install
```

If you want to make changes to the Typescript language service plugin used by the extension, navigate to `src/tsPlugin` and ... TODO: Add description on how to handle tsPlugin modifications