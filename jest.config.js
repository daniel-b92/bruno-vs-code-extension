const path = require("path");

module.exports = {
    // Every worker loads its own TypeScript compiler via ts-jest (~1.5 GiB each).
    // With jest's default (one worker per CPU core - 1) this can exhaust the memory on machines with many cores.
    maxWorkers: 2,
    // Workers are reused across test files and accumulate a TypeScript compiler per project, plus the language services
    // created by the `tsPlugin` tests. Without recycling them, their heap can exceed the default limit of Node.
    workerIdleMemoryLimit: "1GB",
    projects: [
        {
            displayName: "server",
            testEnvironment: "node",
            rootDir: path.resolve(__dirname, "server"),
            transform: {
                "^.+\\.[tj]s$": [
                    "ts-jest",
                    {
                        tsconfig: path.resolve(
                            __dirname,
                            "server/tsconfig.json",
                        ),
                    },
                ],
            },
            transformIgnorePatterns: ["<rootDir>/node_modules/(?!(watcher)/)"],
            moduleNameMapper: {
                "^@global_shared$": path.resolve(__dirname, "shared/index.ts"),
                "^@global_shared/(.*)$": path.resolve(__dirname, "shared/$1"),
            },
            testMatch: [
                "<rootDir>/src/**/*.test.ts",
                "<rootDir>/src/**/*.spec.ts",
            ],
            moduleFileExtensions: ["ts", "tsx", "js", "json"],
            // Compiled output contains copies of the sources & mocks, which must not be picked up.
            modulePathIgnorePatterns: ["<rootDir>/out/"],
        },
        {
            displayName: "client",
            testEnvironment: "node",
            rootDir: path.resolve(__dirname, "client"),
            transformIgnorePatterns: [
                path.resolve(__dirname, "node_modules") +
                    "/(?!(watcher|dettle)/)",
            ],
            transform: {
                "^.+\\.[tj]s$": [
                    "ts-jest",
                    {
                        tsconfig: path.resolve(
                            __dirname,
                            "client/tsconfig.json",
                        ),
                    },
                ],
            },
            moduleNameMapper: {
                "^vscode$": path.resolve(
                    __dirname,
                    "client/src/__mocks__/vscode.ts",
                ),
                "^watcher$": path.resolve(
                    __dirname,
                    "client/src/__mocks__/watcher.ts",
                ),
                "^@global_shared$": path.resolve(__dirname, "shared/index.ts"),
                "^@global_shared/(.*)$": path.resolve(__dirname, "shared/$1"),
                "^@shared$": path.resolve(
                    __dirname,
                    "client/src/shared/index.ts",
                ),
                "^@shared/(.*)$": path.resolve(
                    __dirname,
                    "client/src/shared/$1",
                ),
            },
            testMatch: [
                "<rootDir>/src/**/*.test.ts",
                "<rootDir>/src/**/*.spec.ts",
            ],
            moduleFileExtensions: ["ts", "tsx", "js", "json"],
            // Compiled output contains copies of the sources & mocks, which must not be picked up.
            modulePathIgnorePatterns: ["<rootDir>/out/"],
        },
        {
            displayName: "shared",
            testEnvironment: "node",
            rootDir: path.resolve(__dirname, "shared"),
            transform: {
                "^.+\\.[tj]s$": [
                    "ts-jest",
                    {
                        tsconfig: path.resolve(
                            __dirname,
                            "shared/tsconfig.json",
                        ),
                    },
                ],
            },
            transformIgnorePatterns: ["<rootDir>/node_modules/(?!(watcher)/)"],
            testMatch: ["<rootDir>/**/*.test.ts", "<rootDir>/**/*.spec.ts"],
            moduleFileExtensions: ["ts", "tsx", "js", "json"],
            // Compiled output contains copies of the sources & mocks, which must not be picked up.
            modulePathIgnorePatterns: ["<rootDir>/out/"],
        },
        {
            displayName: "tsPlugin",
            testEnvironment: "node",
            rootDir: path.resolve(__dirname, "tsPlugin"),
            transform: {
                "^.+\\.[tj]s$": [
                    "ts-jest",
                    {
                        tsconfig: path.resolve(
                            __dirname,
                            "tsPlugin/tsconfig.json",
                        ),
                    },
                ],
            },
            testMatch: ["<rootDir>/src/**/*.test.ts"],
            moduleFileExtensions: ["ts", "js", "json"],
            modulePathIgnorePatterns: ["<rootDir>/out/"],
        },
        {
            displayName: "syntaxes",
            testEnvironment: "node",
            rootDir: path.resolve(__dirname, "syntaxes"),
            transform: {
                "^.+\\.ts$": [
                    "ts-jest",
                    {
                        tsconfig: path.resolve(
                            __dirname,
                            "syntaxes/tsconfig.json",
                        ),
                    },
                ],
            },
            testMatch: ["<rootDir>/**/*.test.ts"],
            moduleFileExtensions: ["ts", "js", "json"],
        },
    ],
};
