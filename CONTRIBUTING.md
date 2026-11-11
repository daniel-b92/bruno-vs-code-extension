# Contributing

Thanks for your interest in contributing! This document explains how to set up the project and which checks run for pull requests.

## Setup

You need to have `Node.js` (the CI uses version 24) and `npm` installed. Run the following command to install the dependencies of all projects:

```bash
npm install && cd client && npm install && cd ../server && npm install && cd ../tsPlugin && npm install && cd ..
```

Before opening a pull request, run `npm run lint`, `npm run check-types`, `npm run compile` and `npm run test`. These are the same steps as in the `build-and-test` job of the CI.

## Project structure

The repository consists of several projects, each with its own `package.json`:

- [client/](./client): the extension itself, which runs in the VS Code extension host (e.g. collection explorer, test explorer, running tests via the Bruno CLI).
- [server/](./server): the language server (e.g. diagnostics, completions, hovers, formatting).
- [shared/](./shared): code that is used by both `client` and `server`, e.g. parsing of collection files. Utilities for tests live in `shared/_testingUtils/`.
- [tsPlugin/](./tsPlugin): the Typescript language service plugin that makes code blocks in `.bru` and `yaml` collection files available to the Typescript server. It is published as a separate npm package, see its [Readme](./tsPlugin/README.md).
- [syntaxes/](./syntaxes): the TextMate grammars for syntax highlighting, see [Syntax highlighting](./CONVENTIONS.md#syntax-highlighting).
- [samples/](./samples): example collections for trying out the extension manually. They are not used by the automated tests.

## Running and debugging the extension

Open the repository in VS Code and start one of the launch configurations from [launch.json](./.vscode/launch.json) (Run and Debug view or `F5`). The extension is compiled first and then started in a new Extension Development Host window with the [samples](./samples) folder opened.

- `Debug Extension` attaches the debugger to the extension and to the language server. `Run Extension` starts it without debugging.
- `Debug Extension With local TS plugin` and `Run Extension With local TS plugin` use the local version of the Typescript plugin instead of the published npm package. This requires an additional manual change, see the [Readme of the plugin](./tsPlugin/README.md#debugging).

The extension writes logs to the output channels `BruAsCode` and `BruAsCode Language Server` (View > Output).

Tests can be run for all projects via `npm run test`, or for a single project via `npm run test-server`, `npm run test-shared`, `npm run test-ts-plugin` or `npm run test-syntaxes`.

## Conventions

The conventions for changes (changelog entries, tests, type checking, supporting both collection formats and generated syntax grammars) are described in [CONVENTIONS.md](./CONVENTIONS.md).

## Security checks

Code from this repository runs on the machines of everybody working on it (e.g. on `npm install`, when running npm scripts, or when opening the repository in VS Code), and in the extension that users install. So besides building and testing, the CI runs a few security checks on every pull request. Most of them are allowlists: if your change really needs one of the restricted things, it is not forbidden. Extend the allowlist as described below and **explain in the pull request description why it is needed**.

Any change to the checks themselves (everything in `.github/` and `eslint.config.ts`) is a sensitive change in itself (see the next section) and is reviewed accordingly.

### Sensitive files (`Sensitive files` workflow)

This check fails if a pull request changes files that can execute code automatically on a developer machine. For example:

- `package.json` and `package-lock.json` files, `.npmrc`
- config files that are executed by tools (`*.config.js`, `*.config.ts`, `tsconfig*.json`, `.prettierrc*`)
- editor and AI agent configuration (`.vscode/`, `*.code-workspace`, `.devcontainer/`, `.claude/`, `CLAUDE.md`, `AGENTS.md`, `.mcp.json`; also within subfolders), as well as `CONVENTIONS.md`, which is imported into `CLAUDE.md`
- CI configuration and git settings (`.github/`, `.gitmodules`, `.husky/`)

The complete list is in [sensitive-files.yml](.github/workflows/sensitive-files.yml).

**A failure here is expected and does not block your pull request.** It only tells the maintainer to review these files with extra care. You don't need to do anything, except explaining in the pull request description why the change is needed. It helps to keep changes to these files in separate, small pull requests.

### Install scripts (`supply-chain-checks` job)

Dependencies with install scripts run arbitrary code on `npm install`. The check fails if a lockfile contains a package with an install script that is not in the allowlist, or if one of the repository's own `package.json` files defines a script that npm runs on install (e.g. `postinstall` or `prepare`).

If a new dependency really needs its install script, add the package name to `allowedPackagesWithInstallScripts` in [checkInstallScripts.mjs](.github/scripts/checkInstallScripts.mjs). Prefer dependencies without install scripts where possible.

### Lockfiles (`supply-chain-checks` job)

`npm run check-lockfiles` uses [lockfile-lint](https://www.npmjs.com/package/lockfile-lint) to check all tracked `package-lock.json` files and make sure that all dependencies are downloaded via HTTPS from the npm registry, with a complete `sha512` integrity hash, and that the downloaded package matches the package name in the lockfile. You can run it locally as well.

- Dependencies from git repositories, other registries or URLs are not accepted.
- If a dependency uses an npm alias (e.g. `"string-width-cjs": "npm:string-width@^4.2.0"`), add the alias to `allowedPackageNameAliases` in [checkLockfiles.mjs](.github/scripts/checkLockfiles.mjs), in the format `<alias>:<package name>`.

The job also installs the dependencies of the root project, `client`, `server` and `tsPlugin` (without running install scripts) and runs `npm audit signatures` for each of them, which verifies the registry signatures of all installed packages.

### Dependency review (`dependency-review` job)

Fails if a pull request adds dependencies with known vulnerabilities. Choose a version without the vulnerability, or a different package.

### Hidden Unicode characters (`supply-chain-checks` job)

Fails if a file contains invisible or direction-changing Unicode characters (e.g. zero-width spaces, bidirectional control characters, unusual variation selectors or characters from private use areas). These can make code look different from what it actually does. Emojis are fine, including single variation selectors after emojis (e.g. in `⚠️`), keycap emojis and zero width joiners within emoji sequences.

Usually, the characters were added by accident and can be removed. If a file really needs to contain one of them (e.g. as test data), use an escape sequence (e.g. `\uFEFF`) instead of the character itself if possible. Otherwise, add the file with the allowed code points to `allowedCharactersPerFile` in [checkHiddenUnicode.mjs](.github/scripts/checkHiddenUnicode.mjs).

### Restricted modules and APIs (`npm run lint`)

ESLint does not allow modules and APIs that can spawn processes, access the network or execute code dynamically in TypeScript files. (JavaScript files such as config files are not linted, but are covered by the sensitive files check above.) This includes Node.js modules like `child_process`, `http`, `https`, `net` and `vm`, packages like `axios` or `execa`, the global `fetch`, `eval` and `new Function`, as well as `require()` or `import()` without a string literal.

If a file really needs one of the modules, allow it only for that file via `getAllowedSensitiveImportsConfig(...)` in [eslint.config.ts](eslint.config.ts), like it is done for spawning the Bruno CLI in `spawnChildProcess.ts`. Keep this kind of code in as few files as possible.

### Workflows (`workflow-security-checks` job)

[zizmor](https://docs.zizmor.sh/) checks the GitHub Actions workflows for security issues. When adding or updating an action, reference it by its full commit SHA with the version as a comment (e.g. `uses: actions/checkout@<sha> # v5.1.0`). Dependabot keeps these references up to date.
