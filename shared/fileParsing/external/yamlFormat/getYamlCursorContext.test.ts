import { describe, it, expect } from "@jest/globals";
import {
    BrunoFileType,
    getYamlCursorContext,
    getYamlDescriptorsForInsertedMaps,
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
                existingValues: ["first"],
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

        it("should not find a context on a blank line within a literal block scalar, left of its indentation", () => {
            const context = getContext([
                "runtime:",
                "  scripts:",
                "    - type: before-request",
                "      code: |-",
                "        console.log(1);",
                "§",
                "        console.log(2);",
            ]);

            expect(context).toBeUndefined();
        });

        it("should find the top level map in an empty file", () => {
            const context = getContext(["in§"]);

            expect(context).toMatchObject({ kind: "key", path: [] });
            expect(getExpectedKeys(context)).toContain("info");
        });

        it("should find the top level map in a file that only contains a comment", () => {
            const context = getContext(["# comment", "in§"]);

            expect(context).toMatchObject({ kind: "key", path: [] });
            expect(getExpectedKeys(context)).toContain("info");
        });

        it("should not treat a dash that starts a sequence item as a typed key", () => {
            expect(getContext(["info:", "  -§"])).toBeUndefined();
        });

        it("should not re-indent a key at a valid indentation", () => {
            const context = getContext(["http:", "  method: GET", "  §"]);

            expect(context).toMatchObject({ kind: "key", indentation: 2 });
            expect(
                context?.kind == "key" && context.reindentationRange,
            ).toBeUndefined();
        });

        it("should re-indent a key that is too far in to the deepest possible map", () => {
            const context = getContext([
                "http:",
                "    auth:",
                "        type: basic",
                "        password: secret",
                "         §",
                "runtime:",
            ]);

            expect(context).toMatchObject({
                kind: "key",
                path: ["http", "auth"],
                indentation: 8,
                reindentationRange: {
                    start: { line: 4, character: 0 },
                    end: { line: 4, character: 9 },
                },
            });
        });

        it("should re-indent a key between two indentation levels to the outer map", () => {
            const context = getContext([
                "http:",
                "    auth:",
                "        type: basic",
                "      par§",
            ]);

            expect(context).toMatchObject({
                kind: "key",
                path: ["http"],
                indentation: 4,
                replaceRange: {
                    start: { line: 3, character: 6 },
                    end: { line: 3, character: 9 },
                },
                reindentationRange: {
                    start: { line: 3, character: 0 },
                    end: { line: 3, character: 6 },
                },
            });
        });

        it("should re-indent a key at the indentation of the items of a preceding sequence to the outer map", () => {
            const context = getContext([
                "http:",
                "    body:",
                "        type: json",
                "    params:",
                "        - name: a",
                "          value: b",
                "        au§",
            ]);

            expect(context).toMatchObject({
                kind: "key",
                path: ["http"],
                indentation: 4,
                reindentationRange: {
                    start: { line: 6, character: 0 },
                    end: { line: 6, character: 8 },
                },
            });
            expect(getDefinedKeys(context)).toEqual(["body", "params"]);
        });

        it("should indent a key below a key without value by the indentation step of the document", () => {
            const context = getContext(["http:", "    auth:", "      §"]);

            expect(context).toMatchObject({
                kind: "key",
                path: ["http", "auth"],
                indentation: 8,
            });
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
                isMissingSpaceAfterColon: false,
            });
            expect(
                context?.kind == "value" && context.keyInfo?.allowedValues,
            ).toContain("basic");
        });

        it("should replace the remainder of the value after the cursor", () => {
            const context = getContext([
                "http:",
                "  auth:",
                "    type: ba§sic",
            ]);

            expect(context).toMatchObject({
                kind: "value",
                replaceRange: {
                    start: { line: 2, character: 10 },
                    end: { line: 2, character: 15 },
                },
            });
        });

        it("should not replace the space between the colon and the cursor", () => {
            const context = getContext(["http:", "  auth:", "    type: §"]);

            expect(context).toMatchObject({
                kind: "value",
                replaceRange: {
                    start: { line: 2, character: 10 },
                    end: { line: 2, character: 10 },
                },
                isMissingSpaceAfterColon: false,
            });
        });

        it("should detect a missing space between the colon and the value", () => {
            const context = getContext(["http:", "  auth:", "    type:§"]);

            expect(context).toMatchObject({
                kind: "value",
                path: ["http", "auth", "type"],
                replaceRange: {
                    start: { line: 2, character: 9 },
                    end: { line: 2, character: 9 },
                },
                isMissingSpaceAfterColon: true,
            });
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

        it("should not include a trailing comment in the range to replace", () => {
            const context = getContext([
                "http:",
                "  auth:",
                "    type: ba§sic # comment",
            ]);

            expect(context).toMatchObject({
                kind: "value",
                replaceRange: {
                    start: { line: 2, character: 10 },
                    end: { line: 2, character: 15 },
                },
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

describe("getYamlDescriptorsForInsertedMaps", () => {
    it("should return the expected keys of nested maps that do not exist yet", () => {
        const lines = ["http:", "  method: GET", "  §"];
        const context = getContext(lines);

        const descriptors =
            context?.kind == "key"
                ? getYamlDescriptorsForInsertedMaps({
                      docHelper: new TextDocumentHelper(
                          lines.join("\n").replace("§", ""),
                      ),
                      fileType: BrunoFileType.RequestFile,
                      context,
                      probeCount: 2,
                      getInsertedText: ([headersProbe, authProbe]) =>
                          `headers:\n    - ${headersProbe}: x\n  auth:\n    ${authProbe}: x`,
                  })
                : [];

        expect(descriptors).toHaveLength(2);
        expect(descriptors.map((d) => d?.definedKeys)).toEqual([[], []]);
        expect(
            descriptors.map((d) =>
                d?.expectedKeys
                    .filter(({ isMandatory }) => isMandatory)
                    .map(({ key }) => key),
            ),
        ).toEqual([["name", "value"], ["type"]]);
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
