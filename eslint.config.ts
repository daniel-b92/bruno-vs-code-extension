import boundaries, { Config, Settings, Rules } from "eslint-plugin-boundaries";
import type { Linter } from "eslint";
import * as parser from "@typescript-eslint/parser";

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
    { ignores: ["**/node_modules/**", "**/dist/**", "**/out/**", "**/*.d.ts"] },
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
