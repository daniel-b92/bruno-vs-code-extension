const path = require("path");

module.exports = {
    testEnvironment: "node",
    rootDir: __dirname,
    transform: {
        "^.+\\.[tj]s$": [
            "ts-jest",
            {
                tsconfig: path.resolve(__dirname, "tsconfig.json"),
            },
        ],
    },
    transformIgnorePatterns: ["<rootDir>/node_modules/(?!(watcher)/)"],
    moduleNameMapper: {
        "^@global_shared$": path.resolve(__dirname, "../shared/index.ts"),
        "^@global_shared/(.*)$": path.resolve(__dirname, "../shared/$1"),
    },
    testMatch: ["<rootDir>/src/**/*.test.ts", "<rootDir>/src/**/*.spec.ts"],
    moduleFileExtensions: ["ts", "tsx", "js", "json"],
};
