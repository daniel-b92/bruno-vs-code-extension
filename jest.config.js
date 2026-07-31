module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    roots: ["<rootDir>/server/src"],
    testMatch: ["**/*.test.ts"],
    moduleNameMapper: {
        "^@global_shared$": "<rootDir>/shared/jestGlobalShared.ts",
    },
    transform: {
        "^.+\\.tsx?$": [
            "ts-jest",
            { tsconfig: "<rootDir>/server/tsconfig.json" },
        ],
    },
};
