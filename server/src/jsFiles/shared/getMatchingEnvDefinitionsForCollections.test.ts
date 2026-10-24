import { describe, it, expect } from "@jest/globals";
import { CollectionFormat } from "@global_shared";
import { createCollectionWithEnvironments } from "@global_shared/_testingUtils";
import { getMatchingEnvDefinitionsForCollections } from "./getMatchingEnvDefinitionsForCollections";

describe("getMatchingEnvDefinitionsForCollections", () => {
    it("sorts the matches by collection name", () => {
        const result = getMatchingEnvDefinitionsForCollections(
            [getCollection("/ws/colB"), getCollection("/ws/colA")],
            undefined,
            true,
        );

        expect(result.map(({ collectionName }) => collectionName)).toEqual([
            "colA",
            "colB",
        ]);
    });

    it("uses the full path as name if multiple collections share the same directory name", () => {
        const result = getMatchingEnvDefinitionsForCollections(
            [
                getCollection("/a/api"),
                getCollection("/b/api"),
                getCollection("/b/other"),
            ],
            undefined,
            true,
        );

        expect(result.map(({ collectionName }) => collectionName)).toEqual([
            "/a/api",
            "/b/api",
            "other",
        ]);
    });

    it("does not assign collection names if not requested", () => {
        const result = getMatchingEnvDefinitionsForCollections(
            [getCollection("/ws/colA")],
            undefined,
            false,
        );

        expect(result).toHaveLength(1);
        expect(result[0].collectionName).toBeUndefined();
    });

    it("only returns matches for the given variable name", () => {
        const result = getMatchingEnvDefinitionsForCollections(
            [getCollection("/ws/colA")],
            "unknown",
            true,
        );

        expect(result).toEqual([]);
    });
});

function getCollection(rootDirectory: string) {
    return {
        collection: createCollectionWithEnvironments(
            [{ name: "dev", variables: [{ key: "token", value: "v" }] }],
            CollectionFormat.Bru,
            rootDirectory,
        ),
    };
}
