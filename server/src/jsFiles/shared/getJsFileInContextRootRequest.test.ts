import { describe, it, expect } from "@jest/globals";
import { CollectionFormat, Position, TextDocumentHelper } from "@global_shared";
import { createCollectionWithEnvironments } from "@global_shared/_testingUtils";
import { CancellationToken } from "vscode-languageserver";
import { getJsFileInContextRootRequest } from "./getJsFileInContextRootRequest";
import { LanguageFeatureBaseRequest } from "../../shared";

describe("getJsFileInContextRootRequest", () => {
    it("returns undefined if no collection has a context root containing the file", async () => {
        const result = await getJsFileInContextRootRequest(
            getItemProvider([]),
            baseRequest,
            async () => "dev",
        );

        expect(result).toBeUndefined();
    });

    it("returns all matching collections together with their configured environment", async () => {
        const colA = createCollectionWithEnvironments(
            [],
            CollectionFormat.Bru,
            "/ws/colA",
        );
        const colB = createCollectionWithEnvironments(
            [],
            CollectionFormat.Bru,
            "/ws/colB",
        );

        const result = await getJsFileInContextRootRequest(
            getItemProvider([colA, colB]),
            baseRequest,
            async (collection) => `env-of-${collection.getRootDirectory()}`,
        );

        expect(result?.baseRequest).toBe(baseRequest);
        expect(result?.collections).toEqual([
            { collection: colA, configuredEnvironmentName: "env-of-/ws/colA" },
            { collection: colB, configuredEnvironmentName: "env-of-/ws/colB" },
        ]);
    });
});

const baseRequest: LanguageFeatureBaseRequest = {
    filePath: "/ws/shared/script.js",
    documentHelper: new TextDocumentHelper(""),
    position: new Position(0, 0),
    token: CancellationToken.None,
};

function getItemProvider(
    collections: ReturnType<typeof createCollectionWithEnvironments>[],
) {
    return {
        getCollectionsWithAdditionalContextRootContainingItem: () =>
            collections,
    };
}
