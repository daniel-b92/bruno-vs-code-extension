## About the project

The goal is to provide a VS Code extension that allows working with `Bruno` files like working with code, including intellisense. See [online docs](https://docs.usebruno.com/) for more infos on `Bruno`. This extension only aims at the open source parts of `Bruno`, see also [pricing](https://www.usebruno.com/pricing).


Both the `Bruno` desktop app (see [downloads](https://www.usebruno.com/downloads)) and the official [VS Code extension](https://marketplace.visualstudio.com/items?itemName=bruno-api-client.bruno) both provide a custom UI for navigating and working with the different requests, environments, etc.


However, I personally prefer working on API tests in a code like style with VS Code as my Go-To IDE. That's why I started developing this extension.

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