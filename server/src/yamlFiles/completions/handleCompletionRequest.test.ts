import { describe, it, expect } from "@jest/globals";
import {
    BrunoRequestFile,
    CollectionFormat,
    Position,
    TextDocumentHelper,
} from "@global_shared";
import { createCollectionWithEnvironments } from "@global_shared/_testingUtils";
import { CancellationToken, InsertTextMode } from "vscode-languageserver";
import { TypedCollectionItemProvider } from "../../shared";
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
                newText: "http:\n  $1",
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

    describe("key insertion", () => {
        it("inserts a sequence snippet for sequence keys", async () => {
            const result = await complete(
                requestPath,
                "info:\n  name: Foo\n  type: http\n  \n",
                new Position(3, 2),
            );

            expect(
                result?.find(({ label }) => label == "tags")?.textEdit,
            ).toMatchObject({ newText: "tags:\n    - $1" });
        });

        it("uses the indentation step of the document", async () => {
            const result = await complete(
                requestPath,
                "info:\n    name: Foo\n    \n",
                new Position(2, 4),
            );

            expect(
                result?.find(({ label }) => label == "tags")?.textEdit,
            ).toMatchObject({ newText: "tags:\n        - $1" });
        });

        it("inserts the mandatory keys of the items for a sequence of maps", async () => {
            const result = await complete(
                requestPath,
                "http:\n  method: GET\n  \n",
                new Position(2, 2),
            );

            const headersItem = result?.find(({ label }) => label == "headers");
            expect(headersItem?.textEdit).toMatchObject({
                newText: "headers:\n    - name: $1\n      value: $2",
            });
            expect(headersItem?.command).toBeUndefined();
        });

        it("lets the user choose between the allowed values of mandatory keys", async () => {
            const result = await complete(
                requestPath,
                "runtime:\n  \n",
                new Position(1, 2),
            );

            expect(
                result?.find(({ label }) => label == "scripts")?.textEdit,
            ).toMatchObject({
                newText:
                    "scripts:\n    - type: ${1|before-request,after-response,tests|}\n      code: $2",
            });
        });

        it("inserts the mandatory keys of nested maps and the only allowed values", async () => {
            const result = await complete(
                requestPath,
                "runtime:\n  \n",
                new Position(1, 2),
            );

            expect(
                result?.find(({ label }) => label == "actions")?.textEdit,
            ).toMatchObject({
                newText: [
                    "actions:",
                    "    - phase: after-response",
                    "      type: set-variable",
                    "      selector:",
                    "        expression: $1",
                    "        method: jsonq",
                    "      variable:",
                    "        name: $2",
                    "        scope: runtime",
                ].join("\n"),
            });
        });

        it("prefills the next free sequence when inserting the info map", async () => {
            const result = await complete(
                requestPath,
                "http:\n  method: GET\n",
                new Position(2, 0),
                [new BrunoRequestFile("/collection/other.yml", 4)],
            );

            expect(
                result?.find(({ label }) => label == "info")?.textEdit,
            ).toMatchObject({
                newText:
                    "info:\n  name: $1\n  type: ${2|http,graphql,grpc,websocket|}\n  seq: ${3:5}",
            });
        });

        it("triggers the suggestion for the content of a map without mandatory keys", async () => {
            const result = await complete(
                requestPath,
                "info:\n  name: Foo\n",
                new Position(2, 0),
            );

            expect(
                result?.find(({ label }) => label == "http")?.command,
            ).toEqual({
                title: "Suggest",
                command: "editor.action.triggerSuggest",
            });
        });

        it("inserts the snippets with their indentation as is", async () => {
            const result = await complete(
                requestPath,
                "http:\n  method: GET\n  \n",
                new Position(2, 2),
            );

            expect(
                result?.every(
                    ({ insertTextMode }) =>
                        insertTextMode == InsertTextMode.asIs,
                ),
            ).toBe(true);
        });
        it("triggers the value suggestion for keys with a fixed set of values", async () => {
            const result = await complete(
                requestPath,
                "info:\n  name: Foo\n  \n",
                new Position(2, 2),
            );

            expect(
                result?.find(({ label }) => label == "type")?.command,
            ).toEqual({
                title: "Suggest",
                command: "editor.action.triggerSuggest",
            });
            expect(
                result?.find(({ label }) => label == "seq")?.command,
            ).toBeUndefined();
        });
    });

    describe("re-indentation", () => {
        it("fixes the indentation of a key that is too far in", async () => {
            const result = await complete(
                requestPath,
                "http:\n  method: GET\n     pa\n",
                new Position(2, 7),
            );

            const paramsItem = result?.find(({ label }) => label == "params");
            expect(paramsItem?.textEdit).toEqual({
                newText: "params:\n    - name: $1\n      value: $2",
                range: {
                    start: { line: 2, character: 5 },
                    end: { line: 2, character: 7 },
                },
            });
            expect(paramsItem?.additionalTextEdits).toEqual([
                {
                    newText: "  ",
                    range: {
                        start: { line: 2, character: 0 },
                        end: { line: 2, character: 5 },
                    },
                },
            ]);
        });

        it("does not change the indentation of a key at a valid position", async () => {
            const result = await complete(
                requestPath,
                "http:\n  method: GET\n  \n",
                new Position(2, 2),
            );

            expect(
                result?.every(
                    ({ additionalTextEdits }) => !additionalTextEdits,
                ),
            ).toBe(true);
        });
    });

    describe("completion for all mandatory keys", () => {
        it("inserts all missing mandatory keys at once", async () => {
            const result = await complete(
                requestPath,
                "info:\n  \n",
                new Position(1, 2),
                [new BrunoRequestFile("/collection/other.yml", 1)],
            );

            expect(result?.[0]).toMatchObject({
                label: "name, type, seq",
                textEdit: {
                    newText:
                        "name: $1\n  type: ${2|http,graphql,grpc,websocket|}\n  seq: ${3:2}",
                },
            });
        });

        it("is not provided, if less than two mandatory keys are missing", async () => {
            const result = await complete(
                requestPath,
                "info:\n  name: Foo\n  type: http\n  \n",
                new Position(3, 2),
            );

            expect(result?.some(({ label }) => label.includes(","))).toBe(
                false,
            );
        });
    });

    describe("value completions", () => {
        it("suggests true and false for boolean keys", async () => {
            const result = await complete(
                requestPath,
                "http:\n  headers:\n    - name: Accept\n      disabled: \n",
                new Position(3, 16),
            );

            expect(result?.map(({ label }) => label)).toEqual([
                "true",
                "false",
            ]);
        });

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

    it("replaces the rest of the line when completing a value", async () => {
        const result = await complete(
            requestPath,
            "info:\n  name: Foo\n  type: ht\n",
            new Position(2, 9),
        );

        expect(result?.find(({ label }) => label == "http")?.textEdit).toEqual({
            newText: "http",
            range: {
                start: { line: 2, character: 8 },
                end: { line: 2, character: 10 },
            },
        });
    });

    it("keeps the space after the colon when completing a value", async () => {
        const result = await complete(
            requestPath,
            "http:\n  headers:\n    - name: Accept\n      disabled: \n",
            new Position(3, 16),
        );

        expect(result?.find(({ label }) => label == "false")?.textEdit).toEqual(
            {
                newText: "false",
                range: {
                    start: { line: 3, character: 16 },
                    end: { line: 3, character: 16 },
                },
            },
        );
    });

    it("inserts a space before the value, if it directly follows the colon", async () => {
        const result = await complete(
            requestPath,
            "http:\n  headers:\n    - name: Accept\n      disabled:\n",
            new Position(3, 15),
        );

        expect(result?.find(({ label }) => label == "false")?.textEdit).toEqual(
            {
                newText: " false",
                range: {
                    start: { line: 3, character: 15 },
                    end: { line: 3, character: 15 },
                },
            },
        );
    });

    it("does not suggest tags that are already defined", async () => {
        const result = await complete(
            requestPath,
            "info:\n  name: Foo\n  tags:\n    - a\n    - \n",
            new Position(4, 6),
            [new BrunoRequestFile("/collection/other.yml", 1, ["a", "b"])],
        );

        expect(result?.map(({ label }) => label)).toEqual(["b"]);
    });

    it("returns no completions for a position within a value", async () => {
        const result = await complete(
            requestPath,
            "info:\n  name: Foo bar\n",
            new Position(1, 12),
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
    const collection = createCollectionWithEnvironments(
        environments.map((name) => ({ name })),
        CollectionFormat.Yaml,
    );
    const items = [
        ...additionalRequestFiles,
        new BrunoRequestFile(requestPath),
    ];
    items.forEach((item) =>
        collection.addItem({ item, additionalData: undefined }),
    );

    return handleCompletionRequest({
        baseRequest: {
            filePath,
            documentHelper: new TextDocumentHelper(text),
            position,
            token: CancellationToken.None,
        },
        collection,
        itemProvider: {
            getRegisteredCollections: () => [collection],
        } as unknown as TypedCollectionItemProvider,
    });
}
