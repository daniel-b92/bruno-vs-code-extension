const path = require("path");

module.exports = {
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
        },
    ],
};
