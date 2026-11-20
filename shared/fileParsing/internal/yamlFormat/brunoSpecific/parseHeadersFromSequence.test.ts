import { describe, it, expect } from "@jest/globals";
import {
    getExpectedKeyRange,
    getExpectedSameLineValueRange,
    getMissingKeys,
    makeCommonParsingArgs,
    parseTextIntoYamlDocument,
} from "../../../../_testingUtils";
import { Position, Range } from "../../../..";
import { YAMLSeq } from "yaml";
import { RequestHeaderProperty } from "../../../external/yamlFormat/constants/sharedConstants";
import { parseHeadersFromSequence } from "./parseHeadersFromSequence";

describe("parseHeadersFromSequence", () => {
    it("parses single headers entry from Yaml sequence", () => {
        const documentText = `-   name: asdhfwuhf sdfuhsdufhj
    value: dfgdfg
    description: sdsds`;

        const commonArgs = makeCommonParsingArgs(documentText);
        const { docHelper, fullDocumentRange } = commonArgs;
        const parsedDocument = parseTextIntoYamlDocument(documentText);
        const sequence = parsedDocument.contents as YAMLSeq;
        const { result, errors } = parseHeadersFromSequence({
            headersSequence: sequence,
            commonArgs,
        });

        expect(errors).toHaveLength(0);
        expect(result).toBeDefined();
        expect(result?.enabled).toHaveLength(1);
        const header = result!.enabled[0];
        expect(
            getMissingKeys(commonArgs.mapDescriptors[0]).map(({ key }) => key),
        ).toEqual([RequestHeaderProperty.Disabled]);
        expect(header.valueRange).toEqual(
            new Range(new Position(0, 4), fullDocumentRange.end),
        );
        const expectedProperties = {
            name: {
                keyRange: new Range(new Position(0, 4), new Position(0, 8)),
                valueRange: new Range(
                    new Position(0, 8 + 2),
                    docHelper.getRangeForLine(0)!.end,
                ),
                value: "asdhfwuhf sdfuhsdufhj",
            },
            value: {
                keyRange: getExpectedKeyRange(
                    1,
                    RequestHeaderProperty.Value,
                    4,
                ),
                valueRange: getExpectedSameLineValueRange(
                    1,
                    RequestHeaderProperty.Value,
                    "dfgdfg",
                    4,
                ),
                value: "dfgdfg",
            },
            description: {
                keyRange: getExpectedKeyRange(
                    2,
                    RequestHeaderProperty.Description,
                    4,
                ),
                valueRange: getExpectedSameLineValueRange(
                    2,
                    RequestHeaderProperty.Description,
                    "sdsds",
                    4,
                ),
                value: "sdsds",
            },
            disabled: {
                effectiveValue: false,
            },
        };
        expect(header.properties).toEqual(expectedProperties);
    });

    it("parses multiple header entries from Yaml sequence", () => {
        const documentText = `-   name: name1
    value: dsfsdf
-   name: name2
    value: dfgdfg
    description: sdsds
    disabled: true`;

        const commonArgs = makeCommonParsingArgs(documentText);
        const { fullDocumentRange } = commonArgs;
        const parsedDocument = parseTextIntoYamlDocument(documentText);
        const sequence = parsedDocument.contents as YAMLSeq;
        const { result, errors } = parseHeadersFromSequence({
            headersSequence: sequence,
            commonArgs,
        });

        expect(errors).toHaveLength(0);
        expect(result).toBeDefined();
        expect(result?.enabled).toHaveLength(1);
        expect(result?.disabled).toHaveLength(1);
        const allHeaders = [...result!.enabled, ...result!.disabled];
        const headerWithOnlySomeProps = allHeaders.find(
            ({ properties }) => properties.description === undefined,
        );
        const headerWithAllProps = allHeaders.find(
            ({ properties }) => properties.description !== undefined,
        );
        expect(headerWithOnlySomeProps).toBeDefined();
        expect(headerWithAllProps).toBeDefined();

        const descriptorsWithMissingKeys = commonArgs.mapDescriptors.filter(
            (descriptor) => getMissingKeys(descriptor).length > 0,
        );
        expect(descriptorsWithMissingKeys).toHaveLength(1);
        expect(getMissingKeys(descriptorsWithMissingKeys[0])).toEqual([
            expect.objectContaining({
                key: RequestHeaderProperty.Description,
                isMandatory: false,
            }),
            expect.objectContaining({
                key: RequestHeaderProperty.Disabled,
                isMandatory: false,
            }),
        ]);
        expect(headerWithOnlySomeProps?.valueRange).toEqual(
            new Range(new Position(0, 4), new Position(2, 0)),
        );

        expect(headerWithAllProps?.valueRange).toEqual(
            new Range(new Position(2, 4), fullDocumentRange.end),
        );
        expect(headerWithAllProps?.properties.description?.value).toBe("sdsds");
    });

    it("partially parses header containing invalid properties", () => {
        const documentText = `-   names: asdhfwuhf sdfuhsdufhj
    value: dfgdfg
    description: 
        - value: ssdfd`;

        const commonArgs = makeCommonParsingArgs(documentText);
        const { docHelper, fullDocumentRange } = commonArgs;
        const parsedDocument = parseTextIntoYamlDocument(documentText);
        const sequence = parsedDocument.contents as YAMLSeq;
        const { result, errors } = parseHeadersFromSequence({
            headersSequence: sequence,
            commonArgs,
        });

        expect(errors).toHaveLength(3);
        // Error for invalid key 'names'.
        expect(
            errors.some(({ range }) =>
                range.equals(getExpectedKeyRange(0, "names", 4)),
            ),
        ).toBeTruthy();
        // Error for missing mandatory key 'name'.
        expect(
            errors.some(({ range }) =>
                range.equals(
                    new Range(new Position(0, 4), fullDocumentRange.end),
                ),
            ),
        ).toBeTruthy();
        // Error for invalid value type for property 'description'.
        expect(
            errors.some(({ range }) =>
                range.equals(
                    docHelper.getRangeForLine(
                        docHelper.getLineCount() - 1,
                        true,
                    )!,
                ),
            ),
        ).toBeTruthy();

        expect(result).toBeDefined();
        expect(result?.enabled).toHaveLength(1);
        const header = result!.enabled[0];
        expect(
            getMissingKeys(commonArgs.mapDescriptors[0]).map(({ key }) => key),
        ).toEqual([RequestHeaderProperty.Name, RequestHeaderProperty.Disabled]);
        expect(header.valueRange).toEqual(
            new Range(new Position(0, 4), fullDocumentRange.end),
        );
        expect(header.properties.value?.value).toBe("dfgdfg");
    });
});
