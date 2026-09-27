import { describe, it, expect } from "@jest/globals";
import { createCollectionWithEnvironments } from "../../../../../_testingUtils";
import { getMatchingDefinitionsFromEnvFiles } from "./getMatchingDefinitionsFromEnvFiles";

describe("getMatchingDefinitionsFromEnvFiles", () => {
    it("does not mark a match as inherited when it is the configured environment itself", () => {
        const collection = createCollectionWithEnvironments([
            { name: "Dev", variables: [{ key: "token", value: "dev-token" }] },
        ]);

        const result = getMatchingDefinitionsFromEnvFiles(
            collection,
            undefined,
            "Dev",
        );

        expect(result).toEqual([
            expect.objectContaining({
                isConfiguredEnv: true,
                inheritedByEnvironmentName: undefined,
            }),
        ]);
    });

    it("marks a match as inherited when it comes from an ancestor of the configured environment", () => {
        const collection = createCollectionWithEnvironments([
            {
                name: "Base",
                variables: [{ key: "token", value: "base-token" }],
            },
            { name: "Dev", extends: "Base" },
        ]);

        const result = getMatchingDefinitionsFromEnvFiles(
            collection,
            undefined,
            "Dev",
        );

        expect(result).toEqual([
            expect.objectContaining({
                file: "/collection/environments/Base.bru",
                isConfiguredEnv: false,
                inheritedByEnvironmentName: "Dev",
            }),
        ]);
    });

    it("does not mark a match as inherited when it comes from an unrelated environment", () => {
        const collection = createCollectionWithEnvironments([
            { name: "Dev" },
            {
                name: "Other",
                variables: [{ key: "token", value: "other-token" }],
            },
        ]);

        const result = getMatchingDefinitionsFromEnvFiles(
            collection,
            undefined,
            "Dev",
        );

        expect(result).toEqual([
            expect.objectContaining({
                file: "/collection/environments/Other.bru",
                isConfiguredEnv: false,
                inheritedByEnvironmentName: undefined,
            }),
        ]);
    });

    it("does not mark anything as inherited when no environment is configured", () => {
        const collection = createCollectionWithEnvironments([
            {
                name: "Base",
                variables: [{ key: "token", value: "base-token" }],
            },
            { name: "Dev", extends: "Base" },
        ]);

        const result = getMatchingDefinitionsFromEnvFiles(collection);

        expect(
            result.every(
                ({ inheritedByEnvironmentName }) =>
                    inheritedByEnvironmentName == undefined,
            ),
        ).toBe(true);
    });
});
