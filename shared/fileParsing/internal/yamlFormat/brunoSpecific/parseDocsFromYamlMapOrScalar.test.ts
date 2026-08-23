import { describe, it, expect } from "@jest/globals";
import {
    getExpectedKeyRange,
    getExpectedSameLineValueRange,
    parseTextIntoYamlDocument,
} from "../../../../_testingUtils";
import {
    Position,
    Range,
    TextDocumentHelper,
    WithKeyAndValueRange,
} from "../../../..";
import {
    ParsedDocsWithType,
    ParsedYamlMap,
    WithKeyAndKeyRange,
    WithKeyKeyRangeAndValueRange,
} from "../interfaces";
import { YAMLMap } from "yaml";
import { parseDocsFromYamlMapOrScalar } from "./parseDocsFromYamlMapOrScalar";
import {
    DocsProperty,
    DocsType,
} from "../../../external/yamlFormat/constants/sharedConstants";

describe("parseDocsFromYamlMapOrScalar", () => {
    it("parses docs section with scalar value", () => {
        const documentText = `docs: |-
    some text
    sfsdfsdf`;

        const source: WithKeyKeyRangeAndValueRange<string> = {
            key: "auth",
            keyRange: getExpectedKeyRange(0, "docs", 0),
            value: "some text\nsfsdfsdf",
            valueRange: new Range(
                new Position(1, 4),
                new Position(2, 4 + "sfsdfsdf".length),
            ),
        };
        const docHelper = new TextDocumentHelper(documentText);
        const fullDocumentRange = docHelper.getTextRange();
        const { result, errors } = parseDocsFromYamlMapOrScalar(source, {
            docHelper,
            fullDocumentRange,
        });

        expect(errors).toHaveLength(0);
        expect(result).toBeDefined();
        expect(result?.keyRange).toEqual(source.keyRange);
        expect(result?.valueRange).toEqual(source.valueRange);
        expect(result?.value).toEqual(source.value);
    });

    it("parses docs section with Yaml map value", () => {
        const documentText = `docs:
    content: |-
        asdafd
        sdfsd
        sdfsdfdsfsdfdsfsdf
    type: text/markdown`;

        const docHelper = new TextDocumentHelper(documentText);
        const fullDocumentRange = docHelper.getTextRange();
        const parsedDocument = parseTextIntoYamlDocument(documentText);
        const docsMap = (parsedDocument.contents as YAMLMap).items[0]
            .value as YAMLMap;
        const source: WithKeyAndKeyRange<YAMLMap> = {
            key: "docs",
            keyRange: getExpectedKeyRange(0, "docs", 0),
            value: docsMap,
        };

        const { result, errors } = parseDocsFromYamlMapOrScalar(source, {
            docHelper,
            fullDocumentRange,
        });

        expect(errors).toHaveLength(0);
        expect(result).toBeDefined();

        const expectedValue: ParsedDocsWithType = {
            keyRange: source.keyRange,
            valueRange: new Range(new Position(1, 4), fullDocumentRange.end),
            value: {
                missingProperties: [],
                properties: {
                    content: {
                        keyRange: getExpectedKeyRange(
                            1,
                            DocsProperty.Content,
                            4,
                        ),
                        valueRange: new Range(
                            new Position(1, 4 + "content:".length + 1),
                            new Position(5, 0),
                        ),
                        value: "asdafd\nsdfsd\nsdfsdfdsfsdfdsfsdf",
                    },
                    type: {
                        keyRange: getExpectedKeyRange(5, DocsProperty.Type, 4),
                        valueRange: getExpectedSameLineValueRange(
                            5,
                            DocsProperty.Type,
                            DocsType.TextMarkdown,
                            4,
                        ),
                        value: DocsType.TextMarkdown,
                    },
                },
            },
        };
        expect(result).toEqual(expectedValue);
    });

    it("partially parses docs section provided as Yaml map containing invalid properties", () => {
        const documentText = `docs:
    content: |-
        asdafd
        sdfsd
        sdfsdfdsfsdfdsfsdf
    type: foo
    other: 
        some: eretrte`;

        const docHelper = new TextDocumentHelper(documentText);
        const fullDocumentRange = docHelper.getTextRange();
        const parsedDocument = parseTextIntoYamlDocument(documentText);
        const docsMap = (parsedDocument.contents as YAMLMap).items[0]
            .value as YAMLMap;
        const source: WithKeyAndKeyRange<YAMLMap> = {
            key: "docs",
            keyRange: getExpectedKeyRange(0, "docs", 0),
            value: docsMap,
        };

        const { result, errors } = parseDocsFromYamlMapOrScalar(source, {
            docHelper,
            fullDocumentRange,
        });

        expect(errors).toHaveLength(2);
        // Error for invalid value type for 'type' property.
        expect(
            errors.some(({ range }) =>
                range.equals(
                    getExpectedSameLineValueRange(
                        5,
                        DocsProperty.Type,
                        "foo",
                        4,
                    ),
                ),
            ),
        ).toBeTruthy();
        // Error for unknown key.
        expect(
            errors.some(({ range }) =>
                range.equals(getExpectedKeyRange(6, "other", 4)),
            ),
        ).toBeTruthy();

        expect(result).toBeDefined();
        expect(result!.keyRange).toEqual(source.keyRange);

        const docs = result?.value as ParsedYamlMap<{
            type?: WithKeyAndValueRange<DocsType>;
            content?: WithKeyAndValueRange<string>;
        }>;
        expect(docs.missingProperties).toHaveLength(0);
        expect(docs.properties.content?.value).toBe(
            "asdafd\nsdfsd\nsdfsdfdsfsdfdsfsdf",
        );
        expect(docs.properties.type).toBeUndefined();
    });
});
