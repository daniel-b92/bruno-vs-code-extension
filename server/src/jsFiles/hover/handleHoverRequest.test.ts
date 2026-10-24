import { describe, it, expect } from "@jest/globals";
import { CollectionFormat, Position, TextDocumentHelper } from "@global_shared";
import { createCollectionWithEnvironments } from "@global_shared/_testingUtils";
import { CancellationToken, Hover } from "vscode-languageserver";
import {
    handleHoverRequest,
    handleHoverRequestForJsFileInContextRoot,
} from "./handleHoverRequest";
import { TypedCollectionItemProvider } from "../../shared";

describe("handleHoverRequest for JS files", () => {
    it("shows no collection column for a file within a collection", () => {
        const result = handleHoverRequest({
            baseRequest: getBaseRequest(),
            collection: getCollection("/ws/colA", "a-value"),
            itemProvider: {} as TypedCollectionItemProvider,
        });

        expect(getHoverText(result)).toContain("`a-value`");
        expect(getHoverText(result)).not.toContain("collection");
    });

    it("shows the values of all collections for a file within a shared context root", async () => {
        const result = await handleHoverRequestForJsFileInContextRoot({
            baseRequest: getBaseRequest(),
            collections: [
                { collection: getCollection("/ws/colB", "b-value") },
                { collection: getCollection("/ws/colA", "a-value") },
            ],
        });

        const text = getHoverText(result);
        expect(text).toContain("| value | collection |");
        expect(text.indexOf("a-value")).toBeLessThan(text.indexOf("b-value"));
    });

    it("returns undefined if no collection defines the variable", async () => {
        const result = await handleHoverRequestForJsFileInContextRoot({
            baseRequest: getBaseRequest('bru.getEnvVar("unknown")'),
            collections: [{ collection: getCollection("/ws/colA", "v") }],
        });

        expect(result).toBeUndefined();
    });
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
        position: new Position(0, 15),
        token: CancellationToken.None,
    };
}

function getHoverText(hover: Hover | undefined) {
    const { contents } = hover ?? {};
    return typeof contents == "object" && contents && "value" in contents
        ? contents.value
        : "";
}
