import boundaries, { Config, Settings, Rules } from "eslint-plugin-boundaries";
import * as parser from "@typescript-eslint/parser";

export default [
    { ignores: ["**/node_modules/**", "**/dist/**", "**/out/**", "**/*.d.ts"] },
    {
        files: ["**/*.ts"],
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
                    type: "client_shared",
                    pattern: "client/src/shared/**/*",
                },
                {
                    type: "client_language_features",
                    pattern: "client/src/languageFeatures/**/*",
                },
                {
                    type: "client_test_runner",
                    pattern: "client/src/testRunner/**/*",
                },
                {
                    type: "client_tree_view",
                    pattern: "client/src/treeView/**/*",
                },
            ],
            "boundaries/files": [{ pattern: "**/*.ts", category: "source" }],
            "import/resolver": {
                typescript: {
                    project: [
                        "./tsconfig.json",
                        "./client/tsconfig.json",
                        "./server/tsconfig.json",
                    ],
                },
            },
        } as Settings & Record<string, unknown>,
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
];
