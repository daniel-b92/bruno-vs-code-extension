import { describe, it, expect } from "@jest/globals";
import {
    BrunoRequestFile,
    CollectionFormat,
    Position,
    TextDocumentHelper,
} from "@global_shared";
import { createCollectionWithEnvironments } from "@global_shared/_testingUtils";
import { CancellationToken } from "vscode-languageserver";
import { TypedCollection, TypedCollectionItemProvider } from "../../shared";
import { handleCompletionRequest } from "./handleCompletionRequest";

const requestPath = "/collection/request.yml";
const environmentPath = "/collection/environments/Dev.yml";

describe("handleCompletionRequest for yaml files", () => {
    describe("key completions", () => {
        it("suggests the remaining keys of the map at the cursor", async () => {
            const result = await complete(
                requestPath,
                "info:\n  name: Foo\n  type: http\n  \nhttp:\n  method: GET\n  url: x\n",
                new Position(3, 2),
            );

            const labels = result?.map(({ label }) => label);
            expect(labels).toContain("seq");
            expect(labels).not.toContain("name");
            expect(labels).not.toContain("type");
        });

        it("replaces the typed word and inserts a map snippet for map keys", async () => {
            const result = await complete(
                requestPath,
                "info:\n  name: Foo\n  type: http\nht",
                new Position(3, 2),
            );

            const httpItem = result?.find(({ label }) => label == "http");
            expect(httpItem?.textEdit).toEqual({
                newText: "http:\n  $0",
                range: {
                    start: { line: 3, character: 0 },
                    end: { line: 3, character: 2 },
                },
            });
        });

        it("marks optional keys as optional and sorts mandatory keys first", async () => {
            const result = await complete(
                environmentPath,
                "name: Dev\n",
                new Position(1, 0),
                [],
                ["Dev"],
            );

            const extendsItem = result?.find(({ label }) => label == "extends");
            expect(extendsItem?.labelDetails).toEqual({ detail: " optional" });
            expect(extendsItem?.sortText).toBe("b_extends");
        });
    });

    describe("value completions", () => {
        it("suggests the allowed values of an enum key", async () => {
            const result = await complete(
                requestPath,
                "info:\n  name: Foo\n  type: \n",
                new Position(2, 8),
            );

            expect(result?.map(({ label }) => label)).toEqual(
                expect.arrayContaining(["http", "graphql"]),
            );
        });

        it("suggests the next free sequence for 'info.seq'", async () => {
            const result = await complete(
                requestPath,
                "info:\n  name: Foo\n  type: http\n  seq: \n",
                new Position(3, 7),
                [new BrunoRequestFile("/collection/other.yml", 4)],
            );

            expect(result?.map(({ label }) => label)).toEqual(["5"]);
        });

        it("suggests the environments that can be extended", async () => {
            const result = await complete(
                environmentPath,
                "name: Dev\nextends: \n",
                new Position(1, 9),
                [],
                ["Base", "Dev"],
            );

            expect(result?.map(({ label }) => label)).toEqual(["Base"]);
        });
    });

    it("returns no completions for a position within a value", async () => {
        const result = await complete(
            requestPath,
            "info:\n  name: Foo bar\n",
            new Position(1, 10),
        );

        expect(result).toBeUndefined();
    });
});

async function complete(
    filePath: string,
    text: string,
    position: Position,
    additionalRequestFiles: BrunoRequestFile[] = [],
    environments: string[] = [],
) {
    const collection: TypedCollection = createCollectionWithEnvironments(
        environments.map((name) => ({ name })),
        CollectionFormat.Yaml,
    );
    const items = [
        ...additionalRequestFiles,
        new BrunoRequestFile(requestPath),
    ];
    items.forEach((item) =>
        (
            collection as unknown as {
                addItem: (data: unknown) => void;
            }
        ).addItem({ item, additionalData: undefined }),
    );

    return handleCompletionRequest({
        baseRequest: {
            filePath,
            documentHelper: new TextDocumentHelper(text),
            position,
            token: CancellationToken.None,
        },
        collection,
        itemProvider: {} as TypedCollectionItemProvider,
    });
}
