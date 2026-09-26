import { describe, it, expect } from "@jest/globals";
import {
    getExpectedKeyRange,
    getExpectedSameLineValueRange,
    parseTextIntoYamlDocument,
} from "../../../../_testingUtils";
import { TextDocumentHelper } from "../../../..";
import { YAMLSeq } from "yaml";
import {
    HttpParamType,
    RequestFileHttpSectionParamProperty,
} from "../../../external/yamlFormat/constants/requestFileConstants";
import { parseParamsFromSequence } from "./parseParamsFromSequence";

describe("parseParamsFromSequence", () => {
    it("parses a single param with all fields", () => {
        const documentText = `-   name: my-param
    value: my-value
    type: query
    description: a description
    disabled: false`;

        const { commonArgs, sequence } = parse(documentText);
        const { result, errors } = parseParamsFromSequence(
            sequence,
            commonArgs,
        );

        expect(errors).toHaveLength(0);
        expect(result).toHaveLength(1);
        const param = result![0];
        expect(param.properties.name?.value).toBe("my-param");
        expect(param.properties.value?.value).toBe("my-value");
        expect(param.properties.type?.value).toBe(HttpParamType.Query);
        expect(param.properties.description?.value).toBe("a description");
        expect(param.properties.disabled.effectiveValue).toBe(false);
        expect(param.properties.disabled.field?.value).toBe(false);
        expect(param.missingProperties).toHaveLength(0);
    });

    it("parses multiple params", () => {
        const documentText = `-   name: param1
    value: val1
-   name: param2
    value: val2
    type: path`;

        const { commonArgs, sequence } = parse(documentText);
        const { result, errors } = parseParamsFromSequence(
            sequence,
            commonArgs,
        );

        expect(errors).toHaveLength(0);
        expect(result).toHaveLength(2);
        expect(result![0].properties.name?.value).toBe("param1");
        expect(result![1].properties.name?.value).toBe("param2");
        expect(result![1].properties.type?.value).toBe(HttpParamType.Path);
    });

    it("defaults disabled to false when the field is absent", () => {
        const documentText = `-   name: my-param
    value: my-value`;

        const { commonArgs, sequence } = parse(documentText);
        const { result, errors } = parseParamsFromSequence(
            sequence,
            commonArgs,
        );

        expect(errors).toHaveLength(0);
        expect(result![0].properties.disabled.effectiveValue).toBe(false);
        expect(result![0].properties.disabled.field).toBeUndefined();
    });

    it("lists optional fields as missing but not mandatory when absent", () => {
        const documentText = `-   name: my-param
    value: my-value`;

        const { commonArgs, sequence } = parse(documentText);
        const { result } = parseParamsFromSequence(sequence, commonArgs);

        expect(result![0].missingProperties).toHaveLength(3);
        for (const missing of result![0].missingProperties) {
            expect(missing.isMandatory).toBe(false);
            expect(missing.alwaysHasScalarValue).toBe(true);
        }
    });

    it("marks name and value as mandatory in missingProperties", () => {
        const documentText = `-   type: query`;

        const { commonArgs, sequence } = parse(documentText);
        const { result, errors } = parseParamsFromSequence(
            sequence,
            commonArgs,
        );

        expect(errors).toHaveLength(2);
        expect(
            result![0].missingProperties.some(
                ({ key, isMandatory }) =>
                    key === RequestFileHttpSectionParamProperty.Name &&
                    isMandatory,
            ),
        ).toBe(true);
        expect(
            result![0].missingProperties.some(
                ({ key, isMandatory }) =>
                    key === RequestFileHttpSectionParamProperty.Value &&
                    isMandatory,
            ),
        ).toBe(true);
    });

    it("reports error for unknown key and still parses valid keys", () => {
        const documentText = `-   name: my-param
    value: my-value
    unknown: something`;

        const { commonArgs, sequence } = parse(documentText);
        const { result, errors } = parseParamsFromSequence(
            sequence,
            commonArgs,
        );

        expect(errors).toHaveLength(1);
        expect(errors[0].range).toEqual(getExpectedKeyRange(2, "unknown", 4));
        expect(result![0].properties.name?.value).toBe("my-param");
        expect(result![0].properties.value?.value).toBe("my-value");
    });

    it("reports error for invalid type value and returns undefined type", () => {
        const documentText = `-   name: my-param
    value: my-value
    type: invalid-type`;

        const { commonArgs, sequence } = parse(documentText);
        const { result, errors } = parseParamsFromSequence(
            sequence,
            commonArgs,
        );

        expect(errors).toHaveLength(1);
        expect(result![0].properties.type).toBeUndefined();
    });

    it("returns correct valueRange for each param entry", () => {
        const documentText = `-   name: param1
    value: val1
-   name: param2
    value: val2`;

        const docHelper = new TextDocumentHelper(documentText);
        const commonArgs = {
            docHelper,
            fullDocumentRange: docHelper.getTextRange(),
        };
        const parsedDocument = parseTextIntoYamlDocument(documentText);
        const sequence = parsedDocument.contents as YAMLSeq;
        const { result } = parseParamsFromSequence(sequence, commonArgs);

        expect(result![0].valueRange).toBeDefined();
        expect(result![1].valueRange).toBeDefined();
        expect(result![0].valueRange.start.line).toBe(0);
        expect(result![1].valueRange.start.line).toBe(2);
    });

    it("returns correct keyRange and valueRange for name field", () => {
        const documentText = `-   name: my-param
    value: my-value`;

        const { commonArgs, sequence } = parse(documentText);
        const { result } = parseParamsFromSequence(sequence, commonArgs);

        expect(result![0].properties.name?.keyRange).toEqual(
            getExpectedKeyRange(0, RequestFileHttpSectionParamProperty.Name, 4),
        );
        expect(result![0].properties.name?.valueRange).toEqual(
            getExpectedSameLineValueRange(
                0,
                RequestFileHttpSectionParamProperty.Name,
                "my-param",
                4,
            ),
        );
    });

    it("returns an empty result for an empty sequence", () => {
        const documentText = `[]`;

        const { commonArgs, sequence } = parse(documentText);
        const { result, errors } = parseParamsFromSequence(
            sequence,
            commonArgs,
        );

        expect(errors).toHaveLength(0);
        expect(result).toHaveLength(0);
    });
});

function parse(documentText: string) {
    const docHelper = new TextDocumentHelper(documentText);
    const commonArgs = {
        docHelper,
        fullDocumentRange: docHelper.getTextRange(),
    };
    const parsedDocument = parseTextIntoYamlDocument(documentText);
    const sequence = parsedDocument.contents as YAMLSeq;
    return { commonArgs, sequence };
}
