import { describe, it, expect } from "@jest/globals";
import {
    getExpectedKeyRange,
    getExpectedSameLineValueRange,
    parseTextIntoYamlDocument,
} from "../../../../_testingUtils";
import { Position, Range, TextDocumentHelper } from "../../../..";
import { YAMLMap } from "yaml";
import { getValueFieldFromVariable } from "./getValueFieldFromVariable";
import { VariableType } from "../../../external/yamlFormat/constants/sharedConstants";
import { EnvironmentVariableProperty } from "../../../external/yamlFormat/constants/environmentFileConstants";

describe("getValueFieldFromVariable", () => {
    describe("when value field is absent", () => {
        it("returns empty errors and no result", () => {
            const documentText = `name: my-var
description: some description`;
            const { map, docHelper, fullDocumentRange } =
                parseVariableDefinitionMap(documentText);

            const { result, errors } = getValueFieldFromVariable(map, {
                docHelper,
                fullDocumentRange,
            });

            expect(errors).toHaveLength(0);
            expect(result).toBeUndefined();
        });
    });

    describe("when value field is a plain scalar string", () => {
        it("parses the string value and returns correct ranges", () => {
            const documentText = `name: my-var
value: hello`;
            const { map, docHelper, fullDocumentRange } =
                parseVariableDefinitionMap(documentText);

            const { result, errors } = getValueFieldFromVariable(map, {
                docHelper,
                fullDocumentRange,
            });

            expect(errors).toHaveLength(0);
            expect(result).toBeDefined();
            expect(result).toHaveProperty("value", "hello");
            expect(result).toHaveProperty(
                "keyRange",
                getExpectedKeyRange(1, EnvironmentVariableProperty.Value, 0),
            );
            expect(result).toHaveProperty(
                "valueRange",
                getExpectedSameLineValueRange(
                    1,
                    EnvironmentVariableProperty.Value,
                    "hello",
                    0,
                ),
            );
        });

        it("parses a numeric string value", () => {
            const documentText = `name: my-var
value: "42"`;
            const { map, docHelper, fullDocumentRange } =
                parseVariableDefinitionMap(documentText);

            const { result, errors } = getValueFieldFromVariable(map, {
                docHelper,
                fullDocumentRange,
            });

            expect(errors).toHaveLength(0);
            expect(result).toBeDefined();
            expect(result).toHaveProperty("value", "42");
        });
    });

    describe("when value field is a map with type and data", () => {
        it("parses type and data subfields correctly", () => {
            const documentText = `name: my-var
value:
    type: number
    data: "123"`;
            const { map, docHelper, fullDocumentRange } =
                parseVariableDefinitionMap(documentText);

            const { result, errors } = getValueFieldFromVariable(map, {
                docHelper,
                fullDocumentRange,
            });

            expect(errors).toHaveLength(0);
            expect(result).toBeDefined();
            expect(result).toHaveProperty("keyRange");
            expect(result).toHaveProperty("valueRange");
            expect(result).toHaveProperty("properties");

            const { properties } = result as {
                properties: {
                    type?: { value: string };
                    data?: { value: string };
                };
            };

            expect(properties.type?.value).toBe(VariableType.Number);
            expect(properties.data?.value).toBe("123");
        });

        it("parses boolean type", () => {
            const documentText = `name: flag
value:
    type: boolean
    data: "true"`;
            const { map, docHelper, fullDocumentRange } =
                parseVariableDefinitionMap(documentText);

            const { result, errors } = getValueFieldFromVariable(map, {
                docHelper,
                fullDocumentRange,
            });

            expect(errors).toHaveLength(0);
            const { properties } = result as {
                properties: {
                    type?: { value: string };
                    data?: { value: string };
                };
            };
            expect(properties.type?.value).toBe(VariableType.Boolean);
        });

        it("returns ranges for the value map itself", () => {
            const documentText = `name: my-var
value:
    type: string
    data: hello`;
            const { map, docHelper, fullDocumentRange } =
                parseVariableDefinitionMap(documentText);

            const { result } = getValueFieldFromVariable(map, {
                docHelper,
                fullDocumentRange,
            });

            expect(result).toHaveProperty("keyRange");
            expect(result).toHaveProperty("valueRange");
            // The value map starts on line 2 (0-indexed), after 'value:\n'
            const typedResult = result as {
                keyRange: Range;
                valueRange: Range;
            };
            expect(typedResult.keyRange).toEqual(
                getExpectedKeyRange(1, EnvironmentVariableProperty.Value, 0),
            );
            // Value map range spans from line 2 to end of document
            expect(typedResult.valueRange.start).toEqual(new Position(2, 4));
        });

        it("reports error for unknown subfield in value map", () => {
            const documentText = `name: my-var
value:
    type: number
    data: "1"
    unknown: oops`;
            const { map, docHelper, fullDocumentRange } =
                parseVariableDefinitionMap(documentText);

            const { result, errors } = getValueFieldFromVariable(map, {
                docHelper,
                fullDocumentRange,
            });

            expect(errors).toHaveLength(1);
            expect(
                errors.some(({ range }) =>
                    range.equals(getExpectedKeyRange(4, "unknown", 4)),
                ),
            ).toBeTruthy();
            // Still parses what it can
            expect(result).toBeDefined();
        });

        it("reports error for invalid type value", () => {
            const documentText = `name: my-var
value:
    type: notAValidType
    data: "1"`;
            const { map, docHelper, fullDocumentRange } =
                parseVariableDefinitionMap(documentText);

            const { result, errors } = getValueFieldFromVariable(map, {
                docHelper,
                fullDocumentRange,
            });

            expect(errors).toHaveLength(1);
            expect(
                errors.some(({ range }) =>
                    range.equals(
                        getExpectedSameLineValueRange(
                            2,
                            "type",
                            "notAValidType",
                            4,
                        ),
                    ),
                ),
            ).toBeTruthy();

            const { properties } = result as {
                properties: { type?: unknown; data?: { value: string } };
            };
            // Type is undefined since it was invalid
            expect(properties.type).toBeUndefined();
            // Data is still parsed
            expect(properties.data?.value).toBe("1");
        });

        it("reports error when type subfield is missing", () => {
            const documentText = `name: my-var
value:
    data: "1"`;
            const { map, docHelper, fullDocumentRange } =
                parseVariableDefinitionMap(documentText);

            const { result, errors } = getValueFieldFromVariable(map, {
                docHelper,
                fullDocumentRange,
            });

            expect(errors).toHaveLength(1);
            const { missingProperties } = result as {
                missingProperties: { key: string }[];
            };
            expect(
                missingProperties.some(({ key }) => key === "type"),
            ).toBeTruthy();
        });

        it("reports error when data subfield is missing", () => {
            const documentText = `name: my-var
value:
    type: string`;
            const { map, docHelper, fullDocumentRange } =
                parseVariableDefinitionMap(documentText);

            const { result, errors } = getValueFieldFromVariable(map, {
                docHelper,
                fullDocumentRange,
            });

            expect(errors).toHaveLength(1);
            const { missingProperties } = result as {
                missingProperties: { key: string }[];
            };
            expect(
                missingProperties.some(({ key }) => key === "data"),
            ).toBeTruthy();
        });
    });

    describe("when value field has an unexpected type", () => {
        it("returns an error when value is a sequence instead of scalar or map", () => {
            const documentText = `name: my-var
value:
    - item1
    - item2`;
            const { map, docHelper, fullDocumentRange } =
                parseVariableDefinitionMap(documentText);

            const { result, errors } = getValueFieldFromVariable(map, {
                docHelper,
                fullDocumentRange,
            });

            expect(errors).toHaveLength(1);
            expect(result).toBeUndefined();
        });
    });
});

function parseVariableDefinitionMap(documentText: string): {
    map: YAMLMap;
    docHelper: TextDocumentHelper;
    fullDocumentRange: Range;
} {
    const docHelper = new TextDocumentHelper(documentText);
    const fullDocumentRange = docHelper.getTextRange();
    const parsedDocument = parseTextIntoYamlDocument(documentText);
    const map = parsedDocument.contents as YAMLMap;
    return { map, docHelper, fullDocumentRange };
}
