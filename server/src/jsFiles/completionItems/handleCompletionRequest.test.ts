import { describe, it, expect } from "@jest/globals";
import { CollectionFormat, Position, TextDocumentHelper } from "@global_shared";
import { createCollectionWithEnvironments } from "@global_shared/_testingUtils";
import { CancellationToken } from "vscode-languageserver";
import {
    handleCompletionRequest,
    handleCompletionRequestForJsFileInContextRoot,
} from "./handleCompletionRequest";
import { TypedCollectionItemProvider } from "../../shared";

describe("handleCompletionRequest for JS files", () => {
    it.each(["getEnvVar", "hasEnvVar"])(
        "returns one item per variable name without collection details for %s within a collection",
        async (functionName) => {
            const collection = getCollection("/ws/colA");

            const result = await handleCompletionRequest({
                baseRequest: getBaseRequest(`bru.${functionName}("")`),
                collection,
                itemProvider: {} as TypedCollectionItemProvider,
            });

            expect(result?.map(({ label }) => label)).toEqual(["token"]);
            expect(result?.[0].labelDetails?.description).toBe(
                "Env (2 environments)",
            );
            expect(getDocumentation(result?.[0])).not.toContain("collection");
        },
    );

    it.each(["getEnvVar", "hasEnvVar"])(
        "merges the variables of all collections for %s within a shared context root",
        async (functionName) => {
            const result = await handleCompletionRequestForJsFileInContextRoot({
                baseRequest: getBaseRequest(`bru.${functionName}("")`),
                collections: [
                    { collection: getCollection("/ws/colA") },
                    { collection: getCollection("/ws/colB") },
                ],
            });

            expect(result).toHaveLength(1);
            expect(result?.[0].labelDetails?.description).toBe(
                "Env (multiple collections)",
            );
            expect(getDocumentation(result?.[0])).toMatch(/colA[\s\S]*colB/);
        },
    );

    it.each(["deleteVar", "hasVar", "hasGlobalEnvVar", "deleteGlobalEnvVar"])(
        "returns undefined for %s, whose variables are not defined in environment files",
        async (functionName) => {
            const text = `bru.${functionName}("")`;
            const result = await handleCompletionRequestForJsFileInContextRoot({
                baseRequest: getBaseRequest(
                    text,
                    new Position(0, text.indexOf('"') + 1),
                ),
                collections: [{ collection: getCollection("/ws/colA") }],
            });

            expect(result).toBeUndefined();
        },
    );

    it("warns about the deletion for 'bru.deleteEnvVar'", async () => {
        const result = await handleCompletionRequestForJsFileInContextRoot({
            baseRequest: getBaseRequest(
                'bru.deleteEnvVar("")',
                new Position(0, 18),
            ),
            collections: [{ collection: getCollection("/ws/colA") }],
        });

        expect(result?.[0].labelDetails?.description).toContain("⚠ Delete Env");
        expect(result?.[0].detail).toContain("Will delete");
    });

    it("returns undefined if the cursor is not within an env variable function", async () => {
        const result = await handleCompletionRequestForJsFileInContextRoot({
            baseRequest: getBaseRequest("const a = 1;", new Position(0, 3)),
            collections: [{ collection: getCollection("/ws/colA") }],
        });

        expect(result).toBeUndefined();
    });
});

function getCollection(rootDirectory: string) {
    return createCollectionWithEnvironments(
        ["dev", "prod"].map((name) => ({
            name,
            variables: [{ key: "token", value: `${name}-value` }],
        })),
        CollectionFormat.Bru,
        rootDirectory,
    );
}

function getBaseRequest(
    text = 'bru.getEnvVar("")',
    position = new Position(0, 15),
) {
    return {
        filePath: "/ws/shared/script.js",
        documentHelper: new TextDocumentHelper(text),
        position,
        token: CancellationToken.None,
    };
}

function getDocumentation(item?: { documentation?: unknown }) {
    const { documentation } = item ?? {};
    return typeof documentation == "object" &&
        documentation &&
        "value" in documentation
        ? String(documentation.value)
        : "";
}
