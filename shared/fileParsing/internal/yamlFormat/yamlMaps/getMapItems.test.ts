import { describe, it, expect } from "@jest/globals";
import {
    getExpectedKeyRange,
    getExpectedSameLineValueRange,
    parseTextIntoYamlDocument,
} from "../../../../_testingUtils";
import { TextDocumentHelper } from "../../../..";
import { YAMLMap } from "yaml";
import { getMapItems } from "./getMapItems";

describe("getMapItems", () => {
    describe("missingKeys", () => {
        it("lists each expected key that is absent from the map", () => {
            const documentText = `name: foo`;
            const commonArgs = makeCommonArgs(documentText);
            const map = parseTextIntoYamlDocument(documentText)
                .contents as YAMLMap;

            const { items } = getMapItems(
                map,
                {
                    scalars: {
                        stringValues: ["name", "url"],
                        booleanValues: ["disabled"],
                    },
                },
                commonArgs,
            );

            expect(items.missingKeys).toContain("url");
            expect(items.missingKeys).toContain("disabled");
            expect(items.missingKeys).not.toContain("name");
        });

        it("does not list a key twice when it appears in two expected-key categories", () => {
            const documentText = `other: bar`;
            const commonArgs = makeCommonArgs(documentText);
            const map = parseTextIntoYamlDocument(documentText)
                .contents as YAMLMap;

            const { items } = getMapItems(
                map,
                {
                    scalars: {
                        stringValues: ["name"],
                        booleanValues: ["name"], // same key in two categories
                    },
                },
                commonArgs,
            );

            const nameOccurrences = items.missingKeys.filter(
                (k) => k === "name",
            ).length;
            expect(nameOccurrences).toBe(1);
        });

        it("returns empty missingKeys when all expected keys are present", () => {
            const documentText = `name: foo\ndisabled: true`;
            const commonArgs = makeCommonArgs(documentText);
            const map = parseTextIntoYamlDocument(documentText)
                .contents as YAMLMap;

            const { items, errors } = getMapItems(
                map,
                {
                    scalars: {
                        stringValues: ["name"],
                        booleanValues: ["disabled"],
                    },
                },
                commonArgs,
            );

            expect(errors).toHaveLength(0);
            expect(items.missingKeys).toHaveLength(0);
        });
    });

    describe("unknownKeys", () => {
        it("reports keys that are not in the expected set", () => {
            const documentText = `name: foo\nextra: bar`;
            const commonArgs = makeCommonArgs(documentText);
            const map = parseTextIntoYamlDocument(documentText)
                .contents as YAMLMap;

            const { items } = getMapItems(
                map,
                { scalars: { stringValues: ["name"] } },
                commonArgs,
            );

            expect(items.unknownKeys).toHaveLength(1);
            expect(items.unknownKeys[0].key).toBe("extra");
            expect(items.unknownKeys[0].keyRange).toEqual(
                getExpectedKeyRange(1, "extra", 0),
            );
        });
    });

    describe("valid scalar parsing", () => {
        it("parses string scalars into validScalars.withStringValue", () => {
            const documentText = `name: hello`;
            const commonArgs = makeCommonArgs(documentText);
            const map = parseTextIntoYamlDocument(documentText)
                .contents as YAMLMap;

            const { items, errors } = getMapItems(
                map,
                { scalars: { stringValues: ["name"] } },
                commonArgs,
            );

            expect(errors).toHaveLength(0);
            expect(items.validScalars.withStringValue).toHaveLength(1);
            const entry = items.validScalars.withStringValue[0];
            expect(entry.key).toBe("name");
            expect(entry.value).toBe("hello");
            expect(entry.keyRange).toEqual(getExpectedKeyRange(0, "name", 0));
            expect(entry.valueRange).toEqual(
                getExpectedSameLineValueRange(0, "name", "hello", 0),
            );
        });

        it("parses boolean scalars into validScalars.withBooleanValue", () => {
            const documentText = `disabled: true`;
            const commonArgs = makeCommonArgs(documentText);
            const map = parseTextIntoYamlDocument(documentText)
                .contents as YAMLMap;

            const { items, errors } = getMapItems(
                map,
                { scalars: { booleanValues: ["disabled"] } },
                commonArgs,
            );

            expect(errors).toHaveLength(0);
            expect(items.validScalars.withBooleanValue).toHaveLength(1);
            const entry = items.validScalars.withBooleanValue[0];
            expect(entry.key).toBe("disabled");
            expect(entry.value).toBe(true);
        });

        it("parses numeric scalars into validScalars.withNumericValue", () => {
            const documentText = `timeout: 30`;
            const commonArgs = makeCommonArgs(documentText);
            const map = parseTextIntoYamlDocument(documentText)
                .contents as YAMLMap;

            const { items, errors } = getMapItems(
                map,
                { scalars: { numericValues: ["timeout"] } },
                commonArgs,
            );

            expect(errors).toHaveLength(0);
            expect(items.validScalars.withNumericValue).toHaveLength(1);
            expect(items.validScalars.withNumericValue[0].value).toBe(30);
        });

        it("treats an empty-string value as a valid string scalar", () => {
            const documentText = `name: `;
            const commonArgs = makeCommonArgs(documentText);
            const map = parseTextIntoYamlDocument(documentText)
                .contents as YAMLMap;

            const { items, errors } = getMapItems(
                map,
                { scalars: { stringValues: ["name"] } },
                commonArgs,
            );

            expect(errors).toHaveLength(0);
            expect(items.validScalars.withStringValue).toHaveLength(1);
            expect(items.validScalars.withStringValue[0].value).toBe("");
        });

        it("records an error when a scalar value has the wrong type", () => {
            const documentText = `name: true`;
            const commonArgs = makeCommonArgs(documentText);
            const map = parseTextIntoYamlDocument(documentText)
                .contents as YAMLMap;

            const { items, errors } = getMapItems(
                map,
                { scalars: { stringValues: ["name"] } },
                commonArgs,
            );

            expect(errors).toHaveLength(1);
            expect(items.validScalars.withStringValue).toHaveLength(0);
        });
    });

    describe("sequence and map values", () => {
        it("parses a sequence value into validSequences", () => {
            const documentText = `tags:\n  - a\n  - b`;
            const commonArgs = makeCommonArgs(documentText);
            const map = parseTextIntoYamlDocument(documentText)
                .contents as YAMLMap;

            const { items, errors } = getMapItems(
                map,
                { scalars: {}, sequenceValues: ["tags"] },
                commonArgs,
            );

            expect(errors).toHaveLength(0);
            expect(items.validSequences).toHaveLength(1);
            expect(items.validSequences[0].key).toBe("tags");
        });

        it("records an error when a sequence is found for a non-sequence key", () => {
            const documentText = `name:\n  - a\n  - b`;
            const commonArgs = makeCommonArgs(documentText);
            const map = parseTextIntoYamlDocument(documentText)
                .contents as YAMLMap;

            const { items, errors } = getMapItems(
                map,
                { scalars: { stringValues: ["name"] } },
                commonArgs,
            );

            expect(errors).toHaveLength(1);
            expect(items.validSequences).toHaveLength(0);
        });

        it("parses a nested map value into validMaps", () => {
            const documentText = `auth:\n  type: basic`;
            const commonArgs = makeCommonArgs(documentText);
            const map = parseTextIntoYamlDocument(documentText)
                .contents as YAMLMap;

            const { items, errors } = getMapItems(
                map,
                { scalars: {}, mapValues: ["auth"] },
                commonArgs,
            );

            expect(errors).toHaveLength(0);
            expect(items.validMaps).toHaveLength(1);
            expect(items.validMaps[0].key).toBe("auth");
        });
    });

    describe("error cases", () => {
        it("records an error for an empty-string key", () => {
            // YAML represents "" as a key by emitting a null scalar whose source is "".
            const documentText = `: value`;
            const commonArgs = makeCommonArgs(documentText);
            const map = parseTextIntoYamlDocument(documentText)
                .contents as YAMLMap;

            const { errors } = getMapItems(
                map,
                { scalars: { stringValues: [] } },
                commonArgs,
            );

            expect(errors).toHaveLength(1);
        });
    });
});

function makeCommonArgs(documentText: string) {
    const docHelper = new TextDocumentHelper(documentText);
    return { docHelper, fullDocumentRange: docHelper.getTextRange() };
}
