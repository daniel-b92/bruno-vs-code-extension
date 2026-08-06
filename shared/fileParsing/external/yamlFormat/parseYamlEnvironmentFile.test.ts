import { describe, it, expect } from "@jest/globals";
import { parseYamlEnvironmentFile } from "./parseYamlEnvironmentFile";
import { TextDocumentHelper } from "../../../fileSystem/textDocumentHelper";
import { ParsedEnvironmentVariable, VariableType } from "./interfaces";
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

        const nameLine = 2;

        const expectedVariables: ParsedEnvironmentVariable[] = [
            {
                name: {
                    keyRange: getExpectedKeyRange(nameLine, "name"),
                    value: "var-1",
                    valueRange: getExpectedSameLineValueRange(
                        nameLine,
                        "name",
                        "var-1",
                    ),
                },
                value: {
                    keyRange: getExpectedKeyRange(nameLine + 1, "value"),
                    value: "test-1",
                    valueRange: getExpectedSameLineValueRange(
                        nameLine + 1,
                        "value",
                        "test-1",
                    ),
                },
                description: {
                    keyRange: getExpectedKeyRange(nameLine + 2, "description"),
                    value: "desc",
                    valueRange: getExpectedSameLineValueRange(
                        nameLine + 2,
                        "description",
                        "desc",
                    ),
                },
            },
        ];

        expect(parsed).toEqual({
            name: "Env1",
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
    secret:  true
    disabled: true`;
        const parsed = parseYamlEnvironmentFile(
            new TextDocumentHelper(documentText),
        );
        const firstVarNameLine = 2;
        const secondVarNameLine = 5;

        const expectedVariables: ParsedEnvironmentVariable[] = [
            {
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
                    value: "test-1",
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
            name: "Env1",
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

        const nameLine = 2;

        const expectedVariable: ParsedEnvironmentVariable = {
            name: {
                keyRange: getExpectedKeyRange(nameLine, "name"),
                value: "var-1",
                valueRange: getExpectedSameLineValueRange(
                    nameLine,
                    "name",
                    "var-1",
                ),
            },
            value: {
                data: `{
"id": 2333,
"other": "sdasda"
}`,
                type: VariableType.Object,
            },
            secret: false,
            disabled: false,
        };

        if (!("name" in parsed)) {
            throw new Error(
                `Got error in parsing response. Got ${JSON.stringify(parsed, null, 2)}`,
            );
        }
        expect(parsed.name).toBe("Env1");
        expect(parsed.errors).toHaveLength(0);
        expect(parsed.variables).toHaveLength(1);

        const actualVariable = parsed.variables[0];
        expect(actualVariable.description).toEqual(
            expectedVariable.description,
        );
        expect(actualVariable.disabled).toEqual(expectedVariable.disabled);
        expect(actualVariable.name).toEqual(expectedVariable.name);
        expect(actualVariable.secret).toEqual(expectedVariable.secret);
        expect(actualVariable.type).toEqual(expectedVariable.type);

        if (!actualVariable.value || typeof actualVariable.value == "string") {
            throw new Error(
                `Got unexpected value from the parser. Should be an object, but was ${actualVariable.value}`,
            );
        }
        expect(actualVariable.value.type).toEqual(
            (
                expectedVariable.value as {
                    data: string;
                    type: VariableType.Object;
                }
            ).type,
        );
        expect(JSON.parse(actualVariable.value.data)).toEqual(
            JSON.parse(
                (
                    expectedVariable.value as {
                        data: string;
                        type: VariableType.Object;
                    }
                ).data,
            ),
        );
    });
});

function getExpectedKeyRange(line: number, key: string) {
    const keyStartChar = 4;
    return new Range(
        new Position(line, keyStartChar),
        new Position(line, keyStartChar + key.length),
    );
}

function getExpectedSameLineValueRange(
    line: number,
    key: string,
    value: string,
) {
    const keyStartChar = 4;
    return new Range(
        new Position(line, keyStartChar),
        new Position(line, keyStartChar + key.length + 3 + value.length),
    );
}
