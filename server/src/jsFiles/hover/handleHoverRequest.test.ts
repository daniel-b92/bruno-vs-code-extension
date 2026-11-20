import { describe, it, expect } from "@jest/globals";
import { CollectionFormat, Position, TextDocumentHelper } from "@global_shared";
import {
    createCollectionWithEnvironments,
    getHoverText,
} from "@global_shared/_testingUtils";
import { CancellationToken } from "vscode-languageserver";
import {
    handleHoverRequest,
    handleHoverRequestForJsFileInContextRoot,
} from "./handleHoverRequest";
import { TypedCollectionItemProvider } from "../../shared";

describe("handleHoverRequest for JS files", () => {
    it.each(["getEnvVar", "hasEnvVar"])(
        "shows no collection column for %s within a collection",
        (functionName) => {
            const result = handleHoverRequest({
                baseRequest: getBaseRequest(`bru.${functionName}("token")`),
                collection: getCollection("/ws/colA", "a-value"),
                itemProvider: {} as TypedCollectionItemProvider,
            });

            expect(getHoverText(result)).toContain("`a-value`");
            expect(getHoverText(result)).not.toContain("collection");
        },
    );

    it.each(["getEnvVar", "hasEnvVar"])(
        "shows the values of all collections for %s within a shared context root",
        async (functionName) => {
            const result = await handleHoverRequestForJsFileInContextRoot({
                baseRequest: getBaseRequest(`bru.${functionName}("token")`),
                collections: [
                    { collection: getCollection("/ws/colB", "b-value") },
                    { collection: getCollection("/ws/colA", "a-value") },
                ],
            });

            const text = getHoverText(result);
            expect(text).toContain("| value | collection |");
            expect(text.indexOf("a-value")).toBeLessThan(
                text.indexOf("b-value"),
            );
        },
    );

    it("returns undefined if no collection defines the variable", async () => {
        const result = await handleHoverRequestForJsFileInContextRoot({
            baseRequest: getBaseRequest('bru.getEnvVar("unknown")'),
            collections: [{ collection: getCollection("/ws/colA", "v") }],
        });

        expect(result).toBeUndefined();
    });

    it.each(["hasVar", "hasGlobalEnvVar", "deleteGlobalEnvVar"])(
        "returns no environment-variable hover for %s",
        async (functionName) => {
            const result = await handleHoverRequestForJsFileInContextRoot({
                baseRequest: getBaseRequest(`bru.${functionName}("token")`),
                collections: [{ collection: getCollection("/ws/colA", "v") }],
            });

            expect(result).toBeUndefined();
        },
    );
});

function getCollection(rootDirectory: string, value: string) {
    return createCollectionWithEnvironments(
        [{ name: "dev", variables: [{ key: "token", value }] }],
        CollectionFormat.Bru,
        rootDirectory,
    );
}

function getBaseRequest(text = 'bru.getEnvVar("token")') {
    return {
        filePath: "/ws/shared/script.js",
        documentHelper: new TextDocumentHelper(text),
        position: new Position(0, text.indexOf('"') + 2),
        token: CancellationToken.None,
    };
}
