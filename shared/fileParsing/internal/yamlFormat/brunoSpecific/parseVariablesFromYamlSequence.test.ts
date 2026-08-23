import { describe, it, expect } from "@jest/globals";
import {
    getExpectedKeyRange,
    getExpectedSameLineValueRange,
    parseTextIntoYamlDocument,
} from "../../../../_testingUtils";
import { Position, Range, TextDocumentHelper } from "../../../..";
import { YAMLSeq } from "yaml";
import { RequestVariableProperty } from "../../../external/yamlFormat/constants/sharedConstants";
import { parseVariablesFromYamlSequence } from "./parseVariablesFromYamlSequence";

describe("parseVariablesFromYamlSequence", () => {
    it("parses single variable from Yaml sequence", () => {
        const documentText = `-   name: some name
    value:
        type: number
        data: 343434
    description: sdfs`;

        const docHelper = new TextDocumentHelper(documentText);
        const fullDocumentRange = docHelper.getTextRange();
        const parsedDocument = parseTextIntoYamlDocument(documentText);
        const sequence = parsedDocument.contents as YAMLSeq;
        const { result, errors } = parseVariablesFromYamlSequence(sequence, {
            docHelper,
            fullDocumentRange,
        });

        expect(errors).toHaveLength(0);
        expect(result).toBeDefined();
        expect(result!.enabled).toHaveLength(1);
        expect(result!.disabled).toHaveLength(0);
        const variable = result?.enabled[0];
        expect(variable).toBeDefined();
        expect(variable!.missingProperties).toHaveLength(1);
        expect(variable!.missingProperties[0].key).toEqual(
            RequestVariableProperty.Disabled,
        );
        expect(variable!.valueRange).toEqual(
            new Range(new Position(0, 4), fullDocumentRange.end),
        );
        const expectedProperties = {
            name: {
                keyRange: new Range(new Position(0, 4), new Position(0, 8)),
                valueRange: new Range(
                    new Position(0, 8 + 2),
                    docHelper.getRangeForLine(0)!.end,
                ),
                value: "some name",
            },
            value: {
                missingProperties: [],
                keyRange: getExpectedKeyRange(
                    1,
                    RequestVariableProperty.Value,
                    4,
                ),
                valueRange: new Range(new Position(2, 8), new Position(4, 0)),
                properties: {
                    type: {
                        keyRange: getExpectedKeyRange(2, "type", 8),
                        valueRange: getExpectedSameLineValueRange(
                            2,
                            "type",
                            "number",
                            8,
                        ),
                        value: "number",
                    },
                    data: {
                        keyRange: getExpectedKeyRange(3, "data", 8),
                        valueRange: getExpectedSameLineValueRange(
                            3,
                            "data",
                            "343434",
                            8,
                        ),
                        value: 343434,
                    },
                },
            },
            description: {
                keyRange: getExpectedKeyRange(
                    4,
                    RequestVariableProperty.Description,
                    4,
                ),
                valueRange: getExpectedSameLineValueRange(
                    4,
                    RequestVariableProperty.Description,
                    "sdfs",
                    4,
                ),
                value: "sdfs",
            },
            disabled: { effectiveValue: false },
        };

        expect(variable!.properties).toEqual(expectedProperties);
    });

    it("parses multiple variables from Yaml sequence", () => {
        const documentText = `-   name: some name
    value: fergergeg
    description: sdfs
-   name: other
    value: fergergeg
    disabled: true`;
        const docHelper = new TextDocumentHelper(documentText);
        const fullDocumentRange = docHelper.getTextRange();
        const parsedDocument = parseTextIntoYamlDocument(documentText);
        const sequence = parsedDocument.contents as YAMLSeq;
        const { result, errors } = parseVariablesFromYamlSequence(sequence, {
            docHelper,
            fullDocumentRange,
        });

        expect(errors).toHaveLength(0);
        expect(result).toBeDefined();
        expect(result!.enabled).toHaveLength(1);
        expect(result!.disabled).toHaveLength(1);
        const enabledVariable = result!.enabled[0];
        const disabledVariable = result!.disabled[0];

        expect(enabledVariable.valueRange).toEqual(
            new Range(new Position(0, 4), new Position(3, 0)),
        );
        expect(disabledVariable.valueRange).toEqual(
            new Range(new Position(3, 4), fullDocumentRange.end),
        );
    });

    it("partially parses variable containing invalid properties", () => {
        const documentText = `-   name: some name
    value:
        type: numberss
        data: uuuhuh
    desc: sdfs`;

        const docHelper = new TextDocumentHelper(documentText);
        const fullDocumentRange = docHelper.getTextRange();
        const parsedDocument = parseTextIntoYamlDocument(documentText);
        const sequence = parsedDocument.contents as YAMLSeq;
        const { result, errors } = parseVariablesFromYamlSequence(sequence, {
            docHelper,
            fullDocumentRange,
        });

        expect(errors).toHaveLength(2);
        // Error for invalid value for subproperty 'type' in value field.
        expect(
            errors.some(({ range }) =>
                range.equals(
                    getExpectedSameLineValueRange(2, "type", "numberss", 8),
                ),
            ),
        ).toBeTruthy();
        // Error for invalid key 'eeeee'.
        expect(
            errors.some(({ range }) =>
                range.equals(getExpectedKeyRange(4, "desc", 4)),
            ),
        ).toBeTruthy();

        expect(result).toBeDefined();
        expect(result?.enabled).toHaveLength(1);
        const variable = result!.enabled[0];
        expect(variable.missingProperties).toHaveLength(2);
        expect(
            variable.missingProperties.some(
                ({ key }) => key == RequestVariableProperty.Description,
            ),
        ).toBeTruthy();
        expect(
            variable.missingProperties.some(
                ({ key }) => key == RequestVariableProperty.Disabled,
            ),
        ).toBeTruthy();

        expect(variable.valueRange).toEqual(
            new Range(new Position(0, 4), fullDocumentRange.end),
        );
        expect(variable.properties.name?.value).toBe("some name");
    });
});
