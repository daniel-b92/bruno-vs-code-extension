import { describe, it, expect } from "@jest/globals";
import {
    getExpectedKeyRange,
    getExpectedSameLineValueRange,
    parseTextIntoYamlDocument,
} from "../../../../_testingUtils";
import { TextDocumentHelper } from "../../../..";
import { YAMLSeq } from "yaml";
import {
    AssertionMapProperty,
    AssertionOperator,
} from "../../../external/yamlFormat/constants/sharedConstants";
import { parseAssertionsFromYamlSequence } from "./parseAssertionsFromYamlSequence";

describe("parseAssertionsFromYamlSequence", () => {
    describe("happy path", () => {
        it("parses a single assertion with all fields", () => {
            const documentText = `-   expression: res.status
    operator: eq
    value: expected_value
    description: status check`;

            const { commonArgs, sequence } = parse(documentText);
            const { result, errors } = parseAssertionsFromYamlSequence(
                sequence,
                commonArgs,
            );

            expect(errors).toHaveLength(0);
            expect(result).toHaveLength(1);
            const assertion = result![0];
            expect(assertion.properties.expression?.value).toBe("res.status");
            expect(assertion.properties.operator?.value).toBe(
                AssertionOperator.Equals,
            );
            expect(assertion.properties.value?.value).toBe("expected_value");
            expect(assertion.properties.description?.value).toBe(
                "status check",
            );
        });

        it("parses an assertion with only the mandatory fields", () => {
            const documentText = `-   expression: res.status
    operator: eq`;

            const { commonArgs, sequence } = parse(documentText);
            const { result, errors } = parseAssertionsFromYamlSequence(
                sequence,
                commonArgs,
            );

            expect(errors).toHaveLength(0);
            expect(result).toHaveLength(1);
            const assertion = result![0];
            expect(assertion.properties.expression?.value).toBe("res.status");
            expect(assertion.properties.operator?.value).toBe(
                AssertionOperator.Equals,
            );
            expect(assertion.properties.value).toBeUndefined();
            expect(assertion.properties.description).toBeUndefined();
        });

        it("parses multiple assertions from the sequence", () => {
            const documentText = `-   expression: res.status
    operator: eq
    value: expected_value
-   expression: res.body.id
    operator: neq
    value: some_id`;

            const { commonArgs, sequence } = parse(documentText);
            const { result, errors } = parseAssertionsFromYamlSequence(
                sequence,
                commonArgs,
            );

            expect(errors).toHaveLength(0);
            expect(result).toHaveLength(2);
            expect(result![0].properties.expression?.value).toBe("res.status");
            expect(result![1].properties.expression?.value).toBe("res.body.id");
            expect(result![1].properties.operator?.value).toBe(
                AssertionOperator.NotEquals,
            );
        });

        it("includes correct key and value ranges for parsed properties", () => {
            const documentText = `-   expression: res.status
    operator: eq`;

            const { commonArgs, sequence } = parse(documentText);
            const { result } = parseAssertionsFromYamlSequence(
                sequence,
                commonArgs,
            );

            const assertion = result![0];
            expect(assertion.properties.expression?.keyRange).toEqual(
                getExpectedKeyRange(0, AssertionMapProperty.Expression, 4),
            );
            expect(assertion.properties.expression?.valueRange).toEqual(
                getExpectedSameLineValueRange(
                    0,
                    AssertionMapProperty.Expression,
                    "res.status",
                    4,
                ),
            );
        });
    });

    describe("missing properties", () => {
        it("reports an error for a missing mandatory key 'expression'", () => {
            const documentText = `-   operator: eq
    value: 200`;

            const { commonArgs, sequence } = parse(documentText);
            const { result, errors } = parseAssertionsFromYamlSequence(
                sequence,
                commonArgs,
            );

            expect(result).toHaveLength(1);
            expect(
                errors.some((e) =>
                    e.message
                        .toLowerCase()
                        .includes(AssertionMapProperty.Expression),
                ),
            ).toBeTruthy();
        });

        it("reports an error for a missing mandatory key 'operator'", () => {
            const documentText = `-   expression: res.status
    value: 200`;

            const { commonArgs, sequence } = parse(documentText);
            const { result, errors } = parseAssertionsFromYamlSequence(
                sequence,
                commonArgs,
            );

            expect(result).toHaveLength(1);
            expect(
                errors.some((e) =>
                    e.message
                        .toLowerCase()
                        .includes(AssertionMapProperty.Operator),
                ),
            ).toBeTruthy();
        });

        it("does not report an error for the missing optional key 'value'", () => {
            const documentText = `-   expression: res.status
    operator: eq`;

            const { commonArgs, sequence } = parse(documentText);
            const { errors } = parseAssertionsFromYamlSequence(
                sequence,
                commonArgs,
            );

            expect(errors).toHaveLength(0);
        });

        it("does not report an error for the missing optional key 'description'", () => {
            const documentText = `-   expression: res.status
    operator: eq
    value: expected_value`;

            const { commonArgs, sequence } = parse(documentText);
            const { errors } = parseAssertionsFromYamlSequence(
                sequence,
                commonArgs,
            );

            expect(errors).toHaveLength(0);
        });

        it("records missing optional keys in missingProperties without isMandatory", () => {
            const documentText = `-   expression: res.status
    operator: eq`;

            const { commonArgs, sequence } = parse(documentText);
            const { result } = parseAssertionsFromYamlSequence(
                sequence,
                commonArgs,
            );

            const assertion = result![0];
            const missingValue = assertion.missingProperties.find(
                ({ key }) => key === AssertionMapProperty.Value,
            );
            const missingDescription = assertion.missingProperties.find(
                ({ key }) => key === AssertionMapProperty.Description,
            );
            expect(missingValue?.isMandatory).toBe(false);
            expect(missingDescription?.isMandatory).toBe(false);
        });

        it("records missing mandatory keys in missingProperties with isMandatory", () => {
            const documentText = `-   operator: eq`;

            const { commonArgs, sequence } = parse(documentText);
            const { result } = parseAssertionsFromYamlSequence(
                sequence,
                commonArgs,
            );

            const assertion = result![0];
            const missingExpression = assertion.missingProperties.find(
                ({ key }) => key === AssertionMapProperty.Expression,
            );
            expect(missingExpression?.isMandatory).toBe(true);
        });
    });

    describe("operator validation", () => {
        it("accepts all valid AssertionOperator values", () => {
            for (const operator of Object.values(AssertionOperator)) {
                const documentText = `-   expression: res.status\n    operator: ${operator}`;
                const { commonArgs, sequence } = parse(documentText);
                const { errors } = parseAssertionsFromYamlSequence(
                    sequence,
                    commonArgs,
                );
                expect(errors).toHaveLength(0);
            }
        });

        it("reports an error for an unrecognised operator value", () => {
            const documentText = `-   expression: res.status
    operator: not_a_real_op`;

            const { commonArgs, sequence } = parse(documentText);
            const { errors } = parseAssertionsFromYamlSequence(
                sequence,
                commonArgs,
            );

            expect(errors).toHaveLength(1);
        });

        it("leaves operator undefined in the result when the operator is invalid", () => {
            const documentText = `-   expression: res.status
    operator: not_a_real_op`;

            const { commonArgs, sequence } = parse(documentText);
            const { result } = parseAssertionsFromYamlSequence(
                sequence,
                commonArgs,
            );

            expect(result![0].properties.operator?.value).toBeUndefined();
        });
    });

    describe("unknown keys", () => {
        it("reports an error for an unknown key", () => {
            const documentText = `-   expression: res.status
    operator: eq
    typo: oops`;

            const { commonArgs, sequence } = parse(documentText);
            const { errors } = parseAssertionsFromYamlSequence(
                sequence,
                commonArgs,
            );

            expect(errors).toHaveLength(1);
            expect(
                errors.some((e) =>
                    e.range.equals(getExpectedKeyRange(2, "typo", 4)),
                ),
            ).toBeTruthy();
        });
    });
});

function parse(documentText: string) {
    const docHelper = new TextDocumentHelper(documentText);
    const commonArgs = {
        docHelper,
        fullDocumentRange: docHelper.getTextRange(),
    };
    const sequence = parseTextIntoYamlDocument(documentText)
        .contents as YAMLSeq;
    return { commonArgs, sequence };
}
