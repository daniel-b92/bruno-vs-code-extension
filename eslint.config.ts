import boundaries, { Config, Settings, Rules } from "eslint-plugin-boundaries";
import * as parser from "@typescript-eslint/parser";

export default [
    { ignores: ["**/node_modules/**", "**/dist/**", "**/out/**", "**/*.d.ts"] },
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
                                to: { element: { type: "client_test_runner" } },
                            },
                        },
                        {
                            from: {
                                element: { type: "client_language_features" },
                            },
                            disallow: {
                                to: { element: { type: "client_tree_view" } },
                            },
                        },
                        {
                            from: {
                                element: { type: "client_test_runner" },
                            },
                            disallow: {
                                to: {
                                    element: {
                                        type: "client_language_features",
                                    },
                                },
                            },
                        },
                        {
                            from: {
                                element: { type: "client_test_runner" },
                            },
                            disallow: {
                                to: {
                                    element: {
                                        type: "client_tree_view",
                                    },
                                },
                            },
                        },
                        {
                            from: {
                                element: { type: "client_tree_view" },
                            },
                            disallow: {
                                to: {
                                    element: {
                                        type: "client_language_features",
                                    },
                                },
                            },
                        },
                        {
                            from: {
                                element: { type: "client_tree_view" },
                            },
                            disallow: {
                                to: {
                                    element: {
                                        type: "client_test_runner",
                                    },
                                },
                            },
                        },
                        {
                            from: {
                                element: { type: "client_language_features" },
                            },
                            disallow: {
                                to: {
                                    element: {
                                        type: "client_shared",
                                    },
                                },
                            },
                        },
                    ],
                },
            ],
        } satisfies Rules,
    } satisfies Config,
    {
        files: ["./**/*.ts"],
        languageOptions: {
            parser,
            parserOptions: {
                project: "./tsconfig.json",
                sourceType: "module",
            },
        },
        plugins: {
            boundaries,
        },
        settings: {
            "boundaries/elements": [
                {
                    type: "client",
                    pattern: "client/**",
                },
                {
                    type: "server",
                    pattern: "server/**",
                },
                {
                    type: "tsPlugin",
                    pattern: "tsPlugin/**",
                },
                {
                    type: "shared",
                    pattern: "shared/**",
                },
            ],
            "boundaries/files": [{ pattern: "**/*.ts", category: "source" }],
            "import/resolver": {
                typescript: {
                    project: ["./tsconfig.json"],
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
                                element: { type: "client" },
                            },
                            disallow: {
                                to: { element: { type: "server" } },
                            },
                        },
                        {
                            from: {
                                element: { type: "client" },
                            },
                            disallow: {
                                to: { element: { type: "tsPlugin" } },
                            },
                        },
                        {
                            from: {
                                element: { type: "server" },
                            },
                            disallow: {
                                to: {
                                    element: {
                                        type: "client",
                                    },
                                },
                            },
                        },
                        {
                            from: {
                                element: { type: "server" },
                            },
                            disallow: {
                                to: {
                                    element: {
                                        type: "tsPlugin",
                                    },
                                },
                            },
                        },
                        {
                            from: {
                                element: { type: "tsPlugin" },
                            },
                            disallow: {
                                to: {
                                    element: {
                                        type: "client",
                                    },
                                },
                            },
                        },
                        {
                            from: {
                                element: { type: "tsPlugin" },
                            },
                            disallow: {
                                to: {
                                    element: {
                                        type: "server",
                                    },
                                },
                            },
                        },
                        {
                            from: {
                                element: { type: "client_language_features" },
                            },
                            disallow: {
                                to: {
                                    element: {
                                        type: "client_shared",
                                    },
                                },
                            },
                        },
                    ],
                },
            ],
        } satisfies Rules,
    } satisfies Config,
];
