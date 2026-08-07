import { describe, it, expect } from "@jest/globals";
import { parseYamlEnvironmentFile } from "./parseYamlEnvironmentFile";
import { TextDocumentHelper } from "../../../fileSystem/textDocumentHelper";
import {
    ParsedEnvironmentVariable,
    VariableType,
    WithKeyAndValueRange,
} from "./interfaces";
import { Position, Range } from "../../..";

describe("parseYamlEnvironmentFile", () => {
    it("parses a simple yaml environment file with a single variable", () => {
        const documentText = `name: Env1
variables:
  - name: var-1
    value: test-1
    description: desc`;
        const parsed = parseYamlEnvironmentFile(
            new TextDocumentHelper(documentText),
        );

        const variableNameLine = 2;

        const expectedVariables: ParsedEnvironmentVariable[] = [
            {
                name: {
                    keyRange: getExpectedKeyRange(variableNameLine, "name"),
                    value: "var-1",
                    valueRange: getExpectedSameLineValueRange(
                        variableNameLine,
                        "name",
                        "var-1",
                    ),
                },
                value: {
                    keyRange: getExpectedKeyRange(
                        variableNameLine + 1,
                        "value",
                    ),
                    value: "test-1",
                    valueRange: getExpectedSameLineValueRange(
                        variableNameLine + 1,
                        "value",
                        "test-1",
                    ),
                },
                description: {
                    keyRange: getExpectedKeyRange(
                        variableNameLine + 2,
                        "description",
                    ),
                    value: "desc",
                    valueRange: getExpectedSameLineValueRange(
                        variableNameLine + 2,
                        "description",
                        "desc",
                    ),
                },
                disabled: undefined,
                secret: undefined,
                type: undefined,
            },
        ];

        expect(parsed).toEqual({
            name: {
                keyRange: getExpectedKeyRange(0, "name", 0),
                value: "Env1",
                valueRange: getExpectedSameLineValueRange(0, "name", "Env1", 0),
            },
            variables: expectedVariables,
            errors: [],
        });
    });

    it("parses a yaml environment file with multiple variables", () => {
        const documentText = `name: Env1
variables:
  - name: var-1
    value: test-1
    description: desc
  - name: var-2
    value: test-2
    secret: true
    disabled: true`;
        const parsed = parseYamlEnvironmentFile(
            new TextDocumentHelper(documentText),
        );
        const firstVarNameLine = 2;
        const secondVarNameLine = 5;
        const defaultVariableOptionalFields: Partial<ParsedEnvironmentVariable> =
            {
                description: undefined,
                disabled: undefined,
                secret: undefined,
                type: undefined,
            };

        const expectedVariables: ParsedEnvironmentVariable[] = [
            {
                ...defaultVariableOptionalFields,
                name: {
                    keyRange: getExpectedKeyRange(firstVarNameLine, "name"),
                    value: "var-1",
                    valueRange: getExpectedSameLineValueRange(
                        firstVarNameLine,
                        "name",
                        "var-1",
                    ),
                },
                value: {
                    keyRange: getExpectedKeyRange(
                        firstVarNameLine + 1,
                        "value",
                    ),
                    value: "test-1",
                    valueRange: getExpectedSameLineValueRange(
                        firstVarNameLine + 1,
                        "value",
                        "test-1",
                    ),
                },
                description: {
                    keyRange: getExpectedKeyRange(
                        firstVarNameLine + 2,
                        "description",
                    ),
                    value: "desc",
                    valueRange: getExpectedSameLineValueRange(
                        firstVarNameLine + 2,
                        "description",
                        "desc",
                    ),
                },
            },
            {
                ...defaultVariableOptionalFields,
                name: {
                    keyRange: getExpectedKeyRange(secondVarNameLine, "name"),
                    value: "var-2",
                    valueRange: getExpectedSameLineValueRange(
                        secondVarNameLine,
                        "name",
                        "var-2",
                    ),
                },
                value: {
                    keyRange: getExpectedKeyRange(
                        secondVarNameLine + 1,
                        "value",
                    ),
                    value: "test-2",
                    valueRange: getExpectedSameLineValueRange(
                        secondVarNameLine + 1,
                        "value",
                        "test-2",
                    ),
                },
                secret: {
                    keyRange: getExpectedKeyRange(
                        secondVarNameLine + 2,
                        "secret",
                    ),
                    value: true,
                    valueRange: getExpectedSameLineValueRange(
                        secondVarNameLine + 2,
                        "secret",
                        "true",
                    ),
                },
                disabled: {
                    keyRange: getExpectedKeyRange(
                        secondVarNameLine + 3,
                        "disabled",
                    ),
                    value: true,
                    valueRange: getExpectedSameLineValueRange(
                        secondVarNameLine + 3,
                        "disabled",
                        "true",
                    ),
                },
            },
        ];

        expect(parsed).toEqual({
            name: {
                keyRange: getExpectedKeyRange(0, "name", 0),
                value: "Env1",
                valueRange: getExpectedSameLineValueRange(0, "name", "Env1", 0),
            },
            variables: expectedVariables,
            errors: [],
        });
    });

    it("parses a yaml environment file with a variable of type 'object'", () => {
        const documentText = `name: Env1
variables:
  - name: var-1
    value:
      type: object
      data: |-
        {
        "id": 2333,
        "other": "sdasda"
        }`;
        const parsed = parseYamlEnvironmentFile(
            new TextDocumentHelper(documentText),
        );

        if (!("name" in parsed)) {
            throw new Error(
                `Got error in parsing response. Got ${JSON.stringify(parsed, null, 2)}`,
            );
        }
        expect(parsed.name).toEqual({
            keyRange: getExpectedKeyRange(0, "name", 0),
            value: "Env1",
            valueRange: getExpectedSameLineValueRange(0, "name", "Env1", 0),
        });
        expect(parsed.errors).toHaveLength(0);
        expect(parsed.variables).toHaveLength(1);

        const actualVariable = parsed.variables[0];
        expect(actualVariable.description).toBeUndefined();
        expect(actualVariable.disabled).toBeUndefined();
        expect(actualVariable.name.value).toEqual("var-1");
        expect(actualVariable.secret).toBeUndefined();
        expect(actualVariable.type).toBeUndefined();

        if (
            !actualVariable.value ||
            ("value" in actualVariable.value &&
                typeof actualVariable.value.value == "string")
        ) {
            throw new Error(
                `Got unexpected value from the parser. Should be an object, but was ${actualVariable.value}`,
            );
        }
        const actualValueItem = actualVariable.value as {
            type: WithKeyAndValueRange<VariableType>;
            data: WithKeyAndValueRange<string>;
        };

        const typeLine = 4;
        const typeStartChar = 6;
        expect(actualValueItem.type.value).toEqual(VariableType.Object);
        expect(actualValueItem.type.keyRange).toEqual(
            getExpectedKeyRange(typeLine, "type", typeStartChar),
        );
        expect(actualValueItem.type.valueRange).toEqual(
            getExpectedSameLineValueRange(
                typeLine,
                "type",
                VariableType.Object,
                typeStartChar,
            ),
        );
        expect(JSON.parse(actualValueItem.data.value)).toEqual({
            id: 2333,
            other: "sdasda",
        });
        expect(actualValueItem.data.keyRange).toEqual(
            getExpectedKeyRange(typeLine + 1, "data", typeStartChar),
        );
        expect(actualValueItem.data.valueRange).toEqual(
            new Range(
                new Position(typeLine + 1, typeStartChar + "data".length + 2),
                new Position(typeLine + 5, typeStartChar + 3),
            ),
        );
    });
});

function getExpectedKeyRange(line: number, key: string, keyStartChar = 4) {
    return new Range(
        new Position(line, keyStartChar),
        new Position(line, keyStartChar + key.length),
    );
}

function getExpectedSameLineValueRange(
    line: number,
    key: string,
    value: string,
    keyStartChar = 4,
) {
    return new Range(
        // The '+3' is for the ': ' between the key and the value.
        new Position(line, keyStartChar + key.length + 2),
        new Position(line, keyStartChar + key.length + 2 + value.length),
    );
}
