import { describe, it, expect } from "@jest/globals";
import { applyTextEdits } from "@global_shared/_testingUtils";
import { runUpdatesOnWillSave } from "./runUpdatesOnWillSave";

describe("runUpdatesOnWillSave", () => {
    describe("query params", () => {
        it("updates 'params' if only the URL was modified", () => {
            const lastSaved = getRequestFile("https://example.com?a=1", [
                query("a", "1"),
            ]);
            const current = getRequestFile("https://example.com?a=1&b=2", [
                query("a", "1"),
            ]);

            expect(save(lastSaved, current)).toEqual(
                getRequestFile("https://example.com?a=1&b=2", [
                    query("a", "1"),
                    query("b", "2"),
                ]),
            );
        });

        it("adds the 'params' key if params were pasted into the URL of a request without params", () => {
            const lastSaved = getRequestFile("https://example.com");
            const current = getRequestFile("https://example.com?a=1&b=2");

            expect(save(lastSaved, current)).toEqual(
                getRequestFile("https://example.com?a=1&b=2", [
                    query("a", "1"),
                    query("b", "2"),
                ]),
            );
        });

        it("removes the 'params' key if all params were removed from the URL", () => {
            const lastSaved = getRequestFile("https://example.com?a=1", [
                query("a", "1"),
            ]);
            const current = getRequestFile("https://example.com", [
                query("a", "1"),
            ]);

            expect(save(lastSaved, current)).toEqual(
                getRequestFile("https://example.com"),
            );
        });

        it("updates the URL if only 'params' was modified", () => {
            const lastSaved = getRequestFile("https://example.com?a=1", [
                query("a", "1"),
            ]);
            const current = getRequestFile("https://example.com?a=1", [
                query("a", "1"),
                query("b", "2"),
            ]);

            expect(save(lastSaved, current)).toEqual(
                getRequestFile("https://example.com?a=1&b=2", [
                    query("a", "1"),
                    query("b", "2"),
                ]),
            );
        });

        it("removes the query params from the URL if 'params' was removed", () => {
            const lastSaved = getRequestFile("https://example.com?a=1", [
                query("a", "1"),
            ]);
            const current = getRequestFile("https://example.com?a=1");

            expect(save(lastSaved, current)).toEqual(
                getRequestFile("https://example.com"),
            );
        });

        it("changes nothing if both the URL and 'params' were modified", () => {
            const lastSaved = getRequestFile("https://example.com?a=1", [
                query("a", "1"),
            ]);
            const current = getRequestFile("https://example.com?a=1&b=2", [
                query("a", "1"),
                query("c", "3"),
            ]);

            expect(save(lastSaved, current)).toEqual(current);
        });

        it("changes nothing if neither the URL nor 'params' were modified", () => {
            const content = getRequestFile("https://example.com?a=1", [
                query("a", "1"),
            ]);

            expect(save(content, content)).toEqual(content);
        });

        it("keeps a pre-existing mismatch if neither side was modified", () => {
            const content = getRequestFile("https://example.com?a=1", [
                query("b", "2"),
            ]);

            expect(save(content, content)).toEqual(content);
        });

        it("keeps disabled entries when updating 'params'", () => {
            const lastSaved = getRequestFile("https://example.com", [
                query("c", "3", true),
            ]);
            const current = getRequestFile("https://example.com?a=1", [
                query("c", "3", true),
            ]);

            expect(save(lastSaved, current)).toEqual(
                getRequestFile("https://example.com?a=1", [
                    query("c", "3", true),
                    query("a", "1"),
                ]),
            );
        });

        it("ignores changes to disabled entries", () => {
            const lastSaved = getRequestFile("https://example.com?a=1", [
                query("a", "1"),
                query("c", "3", true),
            ]);
            const current = getRequestFile("https://example.com?a=1", [
                query("a", "1"),
                query("c", "4", true),
            ]);

            expect(save(lastSaved, current)).toEqual(current);
        });

        it("replaces the existing enabled entries in place and keeps other entries", () => {
            const lastSaved = getRequestFile("https://example.com?a=1", [
                query("a", "1"),
                path("id"),
            ]);
            const current = getRequestFile("https://example.com/:id?b=2", [
                query("a", "1"),
                path("id"),
            ]);

            expect(save(lastSaved, current)).toEqual(
                getRequestFile("https://example.com/:id?b=2", [
                    query("b", "2"),
                    path("id"),
                ]),
            );
        });

        it("keeps numeric values as strings", () => {
            const lastSaved = getRequestFile("https://example.com");
            const current = getRequestFile("https://example.com?page=1");

            expect(save(lastSaved, current)).toContain('value: "1"');
        });

        it("updates a quoted URL and keeps the quotes", () => {
            const lastSaved = getRequestFile('"https://example.com"');
            const current = getRequestFile('"https://example.com"', [
                query("a", "1"),
            ]);

            expect(save(lastSaved, current)).toEqual(
                getRequestFile('"https://example.com?a=1"', [query("a", "1")]),
            );
        });

        it("updates a single-quoted URL and keeps the quotes", () => {
            const lastSaved = getRequestFile("'https://example.com'");
            const current = getRequestFile("'https://example.com'", [
                query("a", "1"),
            ]);

            expect(save(lastSaved, current)).toEqual(
                getRequestFile("'https://example.com?a=1'", [query("a", "1")]),
            );
        });

        it("quotes the URL if it is no longer valid as plain scalar", () => {
            const lastSaved = getRequestFile("https://example.com");
            const current = getRequestFile("https://example.com", [
                query("a", "b: c"),
            ]);

            expect(save(lastSaved, current)).toEqual(
                getRequestFile('"https://example.com?a=b: c"', [
                    query("a", "b: c"),
                ]),
            );
        });

        it("keeps CRLF line breaks", () => {
            const lastSaved = getRequestFile("https://example.com");
            const current = getRequestFile("https://example.com?a=1");

            expect(save(toCrlf(lastSaved), toCrlf(current))).toEqual(
                toCrlf(
                    getRequestFile("https://example.com?a=1", [
                        query("a", "1"),
                    ]),
                ),
            );
        });

        it("adds entries if the file does not end with a line break", () => {
            const lastSaved = getRequestFile("https://example.com", [
                query("a", "1"),
            ]).trimEnd();
            const current = lastSaved.replace(
                "example.com",
                "example.com?a=1&b=2",
            );

            expect(save(lastSaved, current)).toEqual(
                getRequestFile("https://example.com?a=1&b=2", [
                    query("a", "1"),
                    query("b", "2"),
                ]).trimEnd(),
            );
        });

        it("changes nothing if 'params' is a flow sequence", () => {
            const lastSaved = getRequestFile("https://example.com").concat(
                "  params: []\n",
            );
            const current = lastSaved.replace("example.com", "example.com?a=1");

            expect(save(lastSaved, current)).toEqual(current);
        });

        it("changes nothing if 'params' contains an invalid entry", () => {
            const invalidEntry = "    - value: x\n      type: query\n";
            const lastSaved = getRequestFile("https://example.com").concat(
                `  params:\n${invalidEntry}`,
            );
            const current = lastSaved.replace("example.com", "example.com?a=1");

            expect(save(lastSaved, current)).toEqual(current);
        });

        it("changes nothing if the Yaml syntax is invalid", () => {
            const lastSaved = getRequestFile("https://example.com");
            const current = getRequestFile("https://example.com?a=1").concat(
                "  broken: [\n",
            );

            expect(save(lastSaved, current)).toEqual(current);
        });
    });

    describe("path params", () => {
        it("adds missing entries if the URL was modified", () => {
            const lastSaved = getRequestFile("https://example.com");
            const current = getRequestFile("https://example.com/:id");

            expect(save(lastSaved, current)).toEqual(
                getRequestFile("https://example.com/:id", [path("id")]),
            );
        });

        it("removes entries that are not part of the URL", () => {
            const lastSaved = getRequestFile("https://example.com/:id", [
                path("id", "5"),
            ]);
            const current = getRequestFile("https://example.com", [
                path("id", "5"),
            ]);

            expect(save(lastSaved, current)).toEqual(
                getRequestFile("https://example.com"),
            );
        });

        it("keeps the values of existing entries", () => {
            const lastSaved = getRequestFile("https://example.com/:id", [
                path("id", "5"),
            ]);
            const current = getRequestFile("https://example.com/:id/:other", [
                path("id", "5"),
            ]);

            expect(save(lastSaved, current)).toEqual(
                getRequestFile("https://example.com/:id/:other", [
                    path("id", "5"),
                    path("other"),
                ]),
            );
        });

        it("does not change the URL if only 'params' was modified", () => {
            const lastSaved = getRequestFile("https://example.com/:id", [
                path("id", "5"),
            ]);
            const current = getRequestFile("https://example.com/:id", [
                path("other", "5"),
            ]);

            expect(save(lastSaved, current)).toEqual(current);
        });

        it("applies the changes for query and path params together", () => {
            const lastSaved = getRequestFile("https://example.com/:id?a=1", [
                query("a", "1"),
                path("id"),
            ]);
            const current = getRequestFile("https://example.com");

            expect(save(lastSaved, current)).toEqual(current);
        });
    });

    it("changes nothing for request types without 'params'", () => {
        const content = (url: string) =>
            `info:\n  name: request\n  type: graphql\n  seq: 1\n\ngraphql:\n  url: ${url}\n`;

        expect(
            save(
                content("https://example.com"),
                content("https://example.com?a=1"),
            ),
        ).toEqual(content("https://example.com?a=1"));
    });
});

function save(lastSavedContent: string, newContent: string) {
    return applyTextEdits(
        newContent,
        runUpdatesOnWillSave(lastSavedContent, newContent),
    );
}

function query(name: string, value: string, disabled = false) {
    return { name, value, type: "query", disabled };
}

function path(name: string, value = "") {
    return { name, value, type: "path", disabled: false };
}

function getRequestFile(
    url: string,
    params: {
        name: string;
        value: string;
        type: string;
        disabled?: boolean;
    }[] = [],
) {
    const paramLines = params.flatMap(({ name, value, type, disabled }) => [
        `    - name: ${name}`,
        `      value: ${JSON.stringify(value)}`,
        ...(disabled ? ["      disabled: true"] : []),
        `      type: ${type}`,
    ]);

    return [
        "info:",
        "  name: request",
        "  type: http",
        "  seq: 1",
        "",
        "http:",
        "  method: GET",
        `  url: ${url}`,
        ...(paramLines.length > 0 ? ["  params:", ...paramLines] : []),
        "",
    ].join("\n");
}

function toCrlf(content: string) {
    return content.replaceAll("\n", "\r\n");
}
