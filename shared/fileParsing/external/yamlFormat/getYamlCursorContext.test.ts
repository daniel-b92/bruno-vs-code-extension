import { describe, it, expect } from "@jest/globals";
import {
    BrunoFileType,
    getYamlCursorContext,
    Position,
    TextDocumentHelper,
} from "../../..";

describe("getYamlCursorContext", () => {
    describe("key position", () => {
        it("should find the top level map for an empty line at the end", () => {
            const context = getContext(["info:", "  name: a", "§"]);

            expect(context).toMatchObject({
                kind: "key",
                path: [],
                indentation: 0,
            });
            expect(getExpectedKeys(context)).toEqual(
                expect.arrayContaining(["info", "http", "runtime"]),
            );
        });

        it("should find the nested map for an empty line between keys", () => {
            const context = getContext([
                "http:",
                "  method: GET",
                "  §",
                "  url: https://example.com",
            ]);

            expect(context).toMatchObject({
                kind: "key",
                path: ["http"],
                indentation: 2,
            });
            expect(getExpectedKeys(context)).toEqual(
                expect.arrayContaining(["method", "url", "headers"]),
            );
            expect(getDefinedKeys(context)).toEqual(["method", "url"]);
        });

        it("should find the map for a half-typed key", () => {
            const context = getContext(["http:", "  method: GET", "  ur§"]);

            expect(context).toMatchObject({
                kind: "key",
                path: ["http"],
                replaceRange: {
                    start: { line: 2, character: 2 },
                    end: { line: 2, character: 4 },
                },
            });
            expect(getDefinedKeys(context)).toEqual(["method"]);
        });

        it("should find the map for an empty line below an empty auth key", () => {
            const context = getContext(["http:", "  auth:", "    §"]);

            expect(context).toMatchObject({
                kind: "key",
                path: ["http", "auth"],
                indentation: 4,
            });
            expect(getExpectedKeys(context)).toContain("type");
        });

        it("should find the map for a new sequence item", () => {
            const context = getContext(["http:", "  headers:", "    - §"]);

            expect(context).toMatchObject({
                kind: "key",
                path: ["http", "headers"],
                indentation: 6,
            });
            expect(getExpectedKeys(context)).toEqual(
                expect.arrayContaining(["name", "value"]),
            );
        });

        it("should find the item map for an empty line inside a sequence item", () => {
            const context = getContext([
                "http:",
                "  headers:",
                "    - name: a",
                "      §",
            ]);

            expect(context).toMatchObject({
                kind: "key",
                path: ["http", "headers"],
                indentation: 6,
            });
            expect(getDefinedKeys(context)).toEqual(["name"]);
        });

        it("should find the map for an empty line after a literal block scalar", () => {
            const context = getContext([
                "runtime:",
                "  scripts:",
                "    - type: before-request",
                "      code: |-",
                "        bru.setVar('a', 'b');",
                "      §",
            ]);

            expect(context).toMatchObject({
                kind: "key",
                path: ["runtime", "scripts"],
            });
            expect(getDefinedKeys(context)).toEqual(["type", "code"]);
        });

        it("should find the map, if other parts of the file have syntax errors", () => {
            const context = getContext(["http:", "  url: {{", "  §"]);

            expect(context).toMatchObject({ kind: "key", path: ["http"] });
        });

        it("should detect a sequence of scalars", () => {
            const context = getContext([
                "info:",
                "  name: a",
                "  tags:",
                "    - first",
                "    - fi§",
            ]);

            expect(context).toMatchObject({
                kind: "sequenceValue",
                path: ["info", "tags"],
                replaceRange: {
                    start: { line: 4, character: 6 },
                    end: { line: 4, character: 8 },
                },
            });
        });

        it("should not find a context inside a literal block scalar", () => {
            const context = getContext([
                "runtime:",
                "  scripts:",
                "    - type: before-request",
                "      code: |-",
                "        §",
            ]);

            expect(context).toBeUndefined();
        });

        it("should not find a context for invalid indentation", () => {
            const context = getContext(["http:", "  method: GET", "   §"]);

            expect(context).toBeUndefined();
        });

        it("should not find a context, if text follows the cursor", () => {
            expect(getContext(["info:", "  §name: a"])).toBeUndefined();
        });
    });

    describe("value position", () => {
        it("should find the key for a value without any text", () => {
            const context = getContext(["http:", "  method: §"]);

            expect(context).toMatchObject({
                kind: "value",
                path: ["http", "method"],
                keyInfo: { key: "method" },
            });
        });

        it("should return the allowed values for a half-typed enum value", () => {
            const context = getContext(["http:", "  auth:", "    type: ba§"]);

            expect(context).toMatchObject({
                kind: "value",
                path: ["http", "auth", "type"],
                replaceRange: {
                    start: { line: 2, character: 10 },
                    end: { line: 2, character: 12 },
                },
            });
            expect(
                context?.kind == "value" && context.keyInfo?.allowedValues,
            ).toContain("basic");
        });

        it("should find the key within a sequence item", () => {
            const context = getContext([
                "http:",
                "  headers:",
                "    - name: Accept",
                "      disabled: §",
            ]);

            expect(context).toMatchObject({
                kind: "value",
                path: ["http", "headers", "disabled"],
                keyInfo: { key: "disabled", valueKinds: ["boolean"] },
            });
        });

        it("should find the info sequence value in a request file", () => {
            const context = getContext(["info:", "  name: a", "  seq: §"]);

            expect(context).toMatchObject({
                kind: "value",
                path: ["info", "seq"],
            });
        });
    });

    it("should work for other file types", () => {
        const context = getContext(
            ["name: a", "§"],
            BrunoFileType.EnvironmentFile,
        );

        expect(context).toMatchObject({ kind: "key", path: [] });
        expect(getExpectedKeys(context)).toEqual(
            expect.arrayContaining(["name", "extends", "variables"]),
        );
    });
});

/** The cursor is marked by a `§` within the given lines. */
function getContext(
    lines: string[],
    fileType: BrunoFileType = BrunoFileType.RequestFile,
) {
    const lineIndex = lines.findIndex((line) => line.includes("§"));
    const text = lines.join("\n").replace("§", "");

    return getYamlCursorContext({
        docHelper: new TextDocumentHelper(text),
        fileType,
        position: new Position(lineIndex, lines[lineIndex].indexOf("§")),
    });
}

function getExpectedKeys(context: ReturnType<typeof getContext>) {
    return context && "descriptor" in context
        ? context.descriptor.expectedKeys.map(({ key }) => key)
        : undefined;
}

function getDefinedKeys(context: ReturnType<typeof getContext>) {
    return context && "descriptor" in context
        ? context.descriptor.definedKeys.map(({ key }) => key)
        : undefined;
}
