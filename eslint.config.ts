import boundaries, { Config, Settings, Rules } from "eslint-plugin-boundaries";
import type { ESLint, Linter } from "eslint";
import * as parser from "@typescript-eslint/parser";
import tsEslintPlugin from "@typescript-eslint/eslint-plugin";

/**
 * Modules that allow spawning processes, accessing the network or executing code in a different context.
 * Since they are rarely needed in this repo, they may only be used in the files that are explicitly allowed below,
 * so that code using them (intentionally or not) cannot be added without changing this config.
 */
const sensitiveModules = [
    "child_process",
    "cluster",
    "dgram",
    "dns",
    "http",
    "http2",
    "https",
    "inspector",
    "module",
    "net",
    "tls",
    "vm",
    "worker_threads",
];
const sensitivePackages = [
    "axios",
    "cross-spawn",
    "execa",
    "got",
    "node-fetch",
    "node-pty",
    "shelljs",
    "tree-kill",
    "undici",
    "ws",
];
const sensitiveModuleMessage =
    "This module allows spawning processes, accessing the network or executing code. If it is really needed, allow it for the specific file in 'eslint.config.ts' (see CONTRIBUTING.md).";

const withoutNodePrefix = (name: string) => name.replace(/^node:/, "");

/**
 * The modules are allowed with and without the `node:` prefix.
 */
const getRestrictedSensitiveModules = (allowedModules: string[]) =>
    [...sensitiveModules, ...sensitivePackages].filter(
        (name) => !allowedModules.map(withoutNodePrefix).includes(name),
    );

const getRestrictedSensitiveImportsRule = (allowedModules: string[] = []) =>
    [
        2,
        {
            paths: getRestrictedSensitiveModules(allowedModules)
                .flatMap((name) =>
                    sensitiveModules.includes(name)
                        ? [name, `node:${name}`]
                        : [name],
                )
                .map((name) => ({ name, message: sensitiveModuleMessage })),
        },
    ] satisfies Linter.RuleEntry;

const getRestrictedSensitiveSyntaxRule = (allowedModules: string[] = []) => {
    const moduleRegex = `/^(node:)?(${getRestrictedSensitiveModules(allowedModules).join("|")})$/`;

    return [
        2,
        {
            selector: `ImportExpression[source.value=${moduleRegex}]`,
            message: sensitiveModuleMessage,
        },
        {
            selector: `CallExpression[callee.name="require"][arguments.0.value=${moduleRegex}]`,
            message: sensitiveModuleMessage,
        },
        {
            selector: `ImportExpression[source.type!="Literal"]`,
            message:
                "Dynamic imports must use a string literal, so that the imported module can be checked.",
        },
        {
            selector: `CallExpression[callee.name="require"][arguments.0.type!="Literal"]`,
            message:
                "'require' must be called with a string literal, so that the imported module can be checked.",
        },
    ] satisfies Linter.RuleEntry;
};

const getAllowedSensitiveImportsConfig = (
    file: string,
    allowedModules: string[],
) =>
    ({
        files: [file],
        rules: {
            "@typescript-eslint/no-restricted-imports":
                getRestrictedSensitiveImportsRule(allowedModules),
            "no-restricted-syntax":
                getRestrictedSensitiveSyntaxRule(allowedModules),
        },
    }) satisfies Linter.Config;

const restrictedSensitiveApisConfig = {
    files: ["**/*.ts"],
    languageOptions: {
        parser,
        // Needed for 'no-implied-eval' to detect the usage of these functions with strings.
        globals: {
            setTimeout: "readonly",
            setInterval: "readonly",
            setImmediate: "readonly",
        },
    },
    plugins: {
        // The types of the plugin's (legacy) configs and rules are not type-compatible with ESLint 10, but this has no effect at runtime.
        "@typescript-eslint": tsEslintPlugin as unknown as ESLint.Plugin,
    },
    rules: {
        "@typescript-eslint/no-restricted-imports":
            getRestrictedSensitiveImportsRule(),
        "no-restricted-syntax": getRestrictedSensitiveSyntaxRule(),
        "no-restricted-globals": [
            2,
            ...["fetch", "WebSocket", "XMLHttpRequest", "EventSource"].map(
                (name) => ({
                    name,
                    message: "Network access is not expected in this repo.",
                }),
            ),
        ],
        "no-restricted-properties": [
            2,
            { object: "globalThis", property: "fetch" },
            { object: "process", property: "binding" },
            { object: "process", property: "dlopen" },
        ],
        "no-eval": 2,
        "no-implied-eval": 2,
        "no-new-func": 2,
    },
} satisfies Linter.Config;

/**
 * Matches relative import specifiers containing a folder for the given format, e.g. `../bruFormat/x` or `./yaml-files`.
 * The folder name has to be the format name itself or continue with an uppercase letter, `-` or `_`.
 * Folders like `brunoSpecific` are intentionally not matched.
 * Only relative imports are matched, since packages (e.g. `yaml-language-server`) do not refer to a folder of this repo.
 */
const getFormatFolderImportRegex = (format: "bru" | "yaml") =>
    `^\\..*(^|/)${format}[A-Z_-][^/]*(/|$)|^\\..*/${format}/`;

const getFormatFolderGlobs = (format: "bru" | "yaml") => [
    `**/${format}[A-Z_-]*/**/*.ts`,
    `**/${format}/**/*.ts`,
];

const getForbiddenCrossFormatImportsConfig = (
    importingFormat: "bru" | "yaml",
    forbiddenFormat: "bru" | "yaml",
) =>
    ({
        files: getFormatFolderGlobs(importingFormat),
        languageOptions: { parser },
        rules: {
            "no-restricted-imports": [
                2,
                {
                    patterns: [
                        {
                            regex: getFormatFolderImportRegex(forbiddenFormat),
                            caseSensitive: true,
                            message: `Code within '${importingFormat}' folders must not import from '${forbiddenFormat}' folders.`,
                        },
                    ],
                },
            ],
        },
    }) satisfies Linter.Config;

export default [
    {
        ignores: [
            "**/node_modules/**",
            "**/dist/**",
            "**/out/**",
            "**/*.d.ts",
            ".claude/**",
        ],
    },
    restrictedSensitiveApisConfig,
    getAllowedSensitiveImportsConfig(
        "client/src/testRunner/internal/testExecutionUtils/spawnChildProcess.ts",
        ["child_process"],
    ),
    getAllowedSensitiveImportsConfig(
        "client/src/testRunner/internal/runTestStructure.ts",
        ["tree-kill"],
    ),
    getForbiddenCrossFormatImportsConfig("yaml", "bru"),
    getForbiddenCrossFormatImportsConfig("bru", "yaml"),
    {
        files: ["client/**/*.ts"],
        languageOptions: {
            parser,
            parserOptions: {
                project: "./client/tsconfig.json",
                sourceType: "module",
            },
        },
        plugins: {
            boundaries,
        },
        settings: {
            "boundaries/elements": [
                {
                    type: "client_shared",
                    pattern: "client/src/shared/**",
                },
                {
                    type: "client_language_features",
                    pattern: "client/src/languageFeatures/**",
                },
                {
                    type: "client_test_runner",
                    pattern: "client/src/testRunner/**",
                },
                {
                    type: "client_tree_view",
                    pattern: "client/src/treeView/**",
                },
                {
                    type: "shared_internal",
                    pattern: "shared/**/internal/**",
                    partialMatch: false,
                },
            ],
            "boundaries/files": [{ pattern: "**/*.ts", category: "source" }],
            "import/resolver": {
                typescript: {
                    project: ["./client/tsconfig.json"],
                },
            },
        } as Settings,
        rules: {
            "boundaries/dependencies": [
                2,
                {
                    default: "allow",
                    policies: [
                        {
                            from: {
                                element: { type: "client_language_features" },
                            },
                            disallow: {
                                to: [
                                    { element: { type: "client_test_runner" } },
                                    { element: { type: "client_tree_view" } },
                                ],
                            },
                        },
                        {
                            from: {
                                element: { type: "client_test_runner" },
                            },
                            disallow: {
                                to: [
                                    {
                                        element: {
                                            type: "client_language_features",
                                        },
                                    },
                                    {
                                        element: {
                                            type: "client_tree_view",
                                        },
                                    },
                                ],
                            },
                        },
                        {
                            from: {
                                element: { type: "client_tree_view" },
                            },
                            disallow: {
                                to: [
                                    {
                                        element: {
                                            type: "client_language_features",
                                        },
                                    },
                                    {
                                        element: {
                                            type: "client_test_runner",
                                        },
                                    },
                                ],
                            },
                        },
                        {
                            from: {
                                element: { type: "client_shared" },
                            },
                            disallow: {
                                to: [
                                    {
                                        element: {
                                            type: "client_language_features",
                                        },
                                    },
                                    {
                                        element: {
                                            type: "client_test_runner",
                                        },
                                    },
                                    {
                                        element: {
                                            type: "client_tree_view",
                                        },
                                    },
                                ],
                            },
                        },
                        {
                            from: [
                                { element: { type: "client_shared" } },
                                {
                                    element: {
                                        type: "client_language_features",
                                    },
                                },
                                { element: { type: "client_test_runner" } },
                                { element: { type: "client_tree_view" } },
                                { element: { type: "unknown" } },
                            ],
                            disallow: {
                                to: {
                                    element: { type: "shared_internal" },
                                },
                            },
                        },
                    ],
                },
            ],
        } satisfies Rules,
    } satisfies Config,
    {
        files: ["server/**/*.ts"],
        languageOptions: {
            parser,
            parserOptions: {
                project: "./server/tsconfig.json",
                sourceType: "module",
            },
        },
        plugins: {
            boundaries,
        },
        settings: {
            "boundaries/elements": [
                {
                    type: "server",
                    pattern: "server/**",
                },
                {
                    type: "shared_internal",
                    pattern: "shared/**/internal/**",
                    partialMatch: false,
                },
            ],
            "boundaries/files": [{ pattern: "**/*.ts", category: "source" }],
            "import/resolver": {
                typescript: {
                    project: ["./server/tsconfig.json"],
                },
            },
        } as Settings,
        rules: {
            "boundaries/dependencies": [
                2,
                {
                    default: "allow",
                    policies: [
                        {
                            from: { element: { type: "server" } },
                            disallow: {
                                to: {
                                    element: { type: "shared_internal" },
                                },
                            },
                        },
                    ],
                },
            ],
        } satisfies Rules,
    } satisfies Config,
];
