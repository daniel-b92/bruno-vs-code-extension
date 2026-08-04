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
    testMatch: ["<rootDir>/**/*.test.ts", "<rootDir>/**/*.spec.ts"],
    moduleFileExtensions: ["ts", "tsx", "js", "json"],
};
