import { describe, it, expect } from "@jest/globals";
import { parseYamlEnvironmentFile } from "./parseYamlEnvironmentFile";
import { TextDocumentHelper } from "../../../fileSystem/textDocumentHelper";
import { ParsedEnvironmentVariable, VariableType } from "./interfaces";

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

        const expectedVariables: ParsedEnvironmentVariable[] = [
            {
                name: "var-1",
                value: "test-1",
                description: "desc",
                secret: false,
                disabled: false,
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

        const expectedVariables: ParsedEnvironmentVariable[] = [
            {
                name: "var-1",
                value: "test-1",
                description: "desc",
                secret: false,
                disabled: false,
            },
            {
                name: "var-2",
                value: "test-2",
                secret: true,
                disabled: true,
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

        const expectedVariable: ParsedEnvironmentVariable = {
            name: "var-1",
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
