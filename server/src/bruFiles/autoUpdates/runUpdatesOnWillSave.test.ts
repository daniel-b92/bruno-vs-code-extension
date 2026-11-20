import { describe, it, expect } from "@jest/globals";
import { TextDocument } from "vscode-languageserver-textdocument";
import { runUpdatesOnWillSave } from "./runUpdatesOnWillSave";

describe("runUpdatesOnWillSave", () => {
    describe("query params", () => {
        it("updates the block if only the URL was modified", () => {
            const lastSaved = getRequestFile("https://example.com?a=1", {
                query: ["a: 1"],
            });
            const current = getRequestFile("https://example.com?a=1&b=2", {
                query: ["a: 1"],
            });

            expect(save(lastSaved, current)).toEqual(
                getRequestFile("https://example.com?a=1&b=2", {
                    query: ["a: 1", "b: 2"],
                }),
            );
        });

        it("adds the block if params were pasted into the URL of a request without params", () => {
            const lastSaved = getRequestFile("https://example.com");
            const current = getRequestFile("https://example.com?a=1&b=2");

            expect(save(lastSaved, current)).toEqual(
                getRequestFile("https://example.com?a=1&b=2", {
                    query: ["a: 1", "b: 2"],
                }),
            );
        });

        it("removes the block if all params were removed from the URL", () => {
            const lastSaved = getRequestFile("https://example.com?a=1", {
                query: ["a: 1"],
            });
            const current = getRequestFile("https://example.com", {
                query: ["a: 1"],
            });

            expect(save(lastSaved, current)).toEqual(
                getRequestFile("https://example.com"),
            );
        });

        it("updates the URL if only the block was modified", () => {
            const lastSaved = getRequestFile("https://example.com?a=1", {
                query: ["a: 1"],
            });
            const current = getRequestFile("https://example.com?a=1", {
                query: ["a: 1", "b: 2"],
            });

            expect(save(lastSaved, current)).toEqual(
                getRequestFile("https://example.com?a=1&b=2", {
                    query: ["a: 1", "b: 2"],
                }),
            );
        });

        it("removes the query params from the URL if the block was removed", () => {
            const lastSaved = getRequestFile("https://example.com?a=1", {
                query: ["a: 1"],
            });
            const current = getRequestFile("https://example.com?a=1");

            expect(save(lastSaved, current)).toEqual(
                getRequestFile("https://example.com"),
            );
        });

        it("changes nothing if both the URL and the block were modified", () => {
            const lastSaved = getRequestFile("https://example.com?a=1", {
                query: ["a: 1"],
            });
            const current = getRequestFile("https://example.com?a=1&b=2", {
                query: ["a: 1", "c: 3"],
            });

            expect(save(lastSaved, current)).toEqual(current);
        });

        it("changes nothing if neither the URL params nor the block were modified", () => {
            const lastSaved = getRequestFile("https://example.com?a=1", {
                query: ["a: 1"],
            });
            const current = getRequestFile("https://other.com?a=1", {
                query: ["a: 1"],
            });

            expect(save(lastSaved, current)).toEqual(current);
        });

        it("does not touch an inconsistency that already existed on the last save", () => {
            const lastSaved = getRequestFile("https://example.com?a=1", {
                query: ["b: 2"],
            });

            expect(save(lastSaved, lastSaved)).toEqual(lastSaved);
        });

        it("ignores changes of disabled entries in the block", () => {
            const lastSaved = getRequestFile("https://example.com?a=1", {
                query: ["a: 1"],
            });
            const current = getRequestFile("https://example.com?a=1&b=2", {
                query: ["a: 1", "~c: 3"],
            });

            expect(save(lastSaved, current)).toEqual(
                getRequestFile("https://example.com?a=1&b=2", {
                    query: ["a: 1", "b: 2", "~c: 3"],
                }),
            );
        });
    });

    describe("path params", () => {
        it("adds missing keys to the block if the URL was modified", () => {
            const lastSaved = getRequestFile("https://example.com/:id", {
                path: ["id: 5"],
            });
            const current = getRequestFile("https://example.com/:id/:name", {
                path: ["id: 5"],
            });

            expect(save(lastSaved, current)).toEqual(
                getRequestFile("https://example.com/:id/:name", {
                    path: ["id: 5", "name: "],
                }),
            );
        });

        it("does not change the URL if only the block was modified", () => {
            const lastSaved = getRequestFile("https://example.com/:id", {
                path: ["id: 5"],
            });
            const current = getRequestFile("https://example.com/:id", {
                path: ["other: 5"],
            });

            expect(save(lastSaved, current)).toEqual(current);
        });
    });

    it("changes nothing for request types that do not support URL params", () => {
        const lastSaved = getRequestFile("grpc://example.com", {}, "grpc");
        const current = getRequestFile("grpc://example.com?a=1", {}, "grpc");

        expect(save(lastSaved, current)).toEqual(current);
    });

    it("changes nothing if the query params block is invalid", () => {
        const lastSaved = getRequestFile("https://example.com", {
            query: ["a: 1", "b"],
        });
        const current = getRequestFile("https://example.com?a=1", {
            query: ["a: 1", "b"],
        });

        expect(save(lastSaved, current)).toEqual(current);
    });
});

function save(lastSavedContent: string, newContent: string) {
    return TextDocument.applyEdits(
        TextDocument.create("file:///request.bru", "bru", 1, newContent),
        runUpdatesOnWillSave(lastSavedContent, newContent),
    );
}

function getRequestFile(
    url: string,
    blocks: { query?: string[]; path?: string[] } = {},
    type = "http",
) {
    const dictionaryBlock = (name: string, lines?: string[]) =>
        lines ? [`${name} {\n${lines.map((l) => `  ${l}\n`).join("")}}`] : [];

    return [
        `meta {\n  name: request\n  type: ${type}\n  seq: 1\n}`,
        `get {\n  url: ${url}\n  body: none\n  auth: none\n}`,
        ...dictionaryBlock("params:query", blocks.query),
        ...dictionaryBlock("params:path", blocks.path),
    ]
        .join("\n\n")
        .concat("\n");
}
