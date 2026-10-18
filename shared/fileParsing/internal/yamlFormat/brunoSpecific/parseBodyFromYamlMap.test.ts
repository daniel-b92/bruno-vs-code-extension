import { describe, it, expect } from "@jest/globals";
import {
    getExpectedKeyRange,
    getExpectedSameLineValueRange,
    getMissingKeys,
    makeCommonParsingArgs,
    parseTextIntoYamlDocument,
} from "../../../../_testingUtils";
import { YAMLMap } from "yaml";
import { WithKeyAndKeyRange } from "../interfaces";
import { parseBodyFromYamlMap } from "./parseBodyFromYamlMap";
import {
    HttpBodyType,
    RequestFileHttpSectionBodyProperty,
} from "../../../external/yamlFormat/constants/requestFileConstants";

describe("parseBodyFromYamlMap", () => {
    it("parses type and data when both are present", () => {
        const documentText = `body:\n  type: json\n  data: some-payload`;
        const { commonArgs, bodyMap } = makeBodyMap(documentText);

        const { result, errors } = parseBodyFromYamlMap(bodyMap, commonArgs);

        expect(errors).toHaveLength(0);
        expect(result).toBeDefined();
        expect(result!.properties.type?.value).toBe(HttpBodyType.Json);
        expect(result!.properties.data?.value).toBe("some-payload");
    });

    it("returns undefined data and lists data as missing when only type is present", () => {
        const documentText = `body:\n  type: xml`;
        const { commonArgs, bodyMap } = makeBodyMap(documentText);

        const { result, errors } = parseBodyFromYamlMap(bodyMap, commonArgs);

        expect(errors).toHaveLength(0);
        expect(result).toBeDefined();
        expect(result!.properties.type?.value).toBe(HttpBodyType.Xml);
        expect(result!.properties.data).toBeUndefined();
        expect(
            getMissingKeys(commonArgs.mapDescriptors[0]).map(({ key }) => key),
        ).toEqual([RequestFileHttpSectionBodyProperty.Data]);
    });

    it("returns undefined type and lists type as missing when only data is present", () => {
        const documentText = `body:\n  data: hello`;
        const { commonArgs, bodyMap } = makeBodyMap(documentText);

        const { result, errors } = parseBodyFromYamlMap(bodyMap, commonArgs);

        expect(errors).toHaveLength(0);
        expect(result).toBeDefined();
        expect(result!.properties.type).toBeUndefined();
        expect(result!.properties.data?.value).toBe("hello");
        expect(
            getMissingKeys(commonArgs.mapDescriptors[0]).map(({ key }) => key),
        ).toEqual([RequestFileHttpSectionBodyProperty.Type]);
    });

    it("lists both keys as missing when the body map is empty", () => {
        const documentText = `body: {}`;
        const { commonArgs, bodyMap } = makeBodyMap(documentText);

        const { result, errors } = parseBodyFromYamlMap(bodyMap, commonArgs);

        expect(errors).toHaveLength(0);
        expect(result).toBeDefined();
        expect(result!.properties.type).toBeUndefined();
        expect(result!.properties.data).toBeUndefined();
        expect(getMissingKeys(commonArgs.mapDescriptors[0])).toHaveLength(2);
    });

    it("records an error and returns undefined type when type value is not a valid HttpBodyType", () => {
        const documentText = `body:\n  type: invalid-body-type\n  data: some data`;
        const { commonArgs, bodyMap } = makeBodyMap(documentText);

        const { result, errors } = parseBodyFromYamlMap(bodyMap, commonArgs);

        expect(errors).toHaveLength(1);
        expect(result).toBeDefined();
        expect(result!.properties.type).toBeUndefined();
        expect(result!.properties.data?.value).toBe("some data");
    });

    it("produces the correct keyRange and valueRange on the result", () => {
        const documentText = `body:\n  type: none`;
        const { commonArgs, bodyMap } = makeBodyMap(documentText);

        const { result } = parseBodyFromYamlMap(bodyMap, commonArgs);

        expect(result).toBeDefined();
        expect(result!.keyRange).toEqual(getExpectedKeyRange(0, "body", 0));
        expect(result!.valueRange).toBeDefined();
    });

    it("returns correct valueRange and keyRange for type and data fields", () => {
        const documentText = `body:\n  type: text\n  data: hello`;
        const { commonArgs, bodyMap } = makeBodyMap(documentText);

        const { result } = parseBodyFromYamlMap(bodyMap, commonArgs);

        expect(result).toBeDefined();
        expect(result!.properties.type?.keyRange).toEqual(
            getExpectedKeyRange(1, "type", 2),
        );
        expect(result!.properties.type?.valueRange).toEqual(
            getExpectedSameLineValueRange(1, "type", "text", 2),
        );
        expect(result!.properties.data?.keyRange).toEqual(
            getExpectedKeyRange(2, "data", 2),
        );
        expect(result!.properties.data?.valueRange).toEqual(
            getExpectedSameLineValueRange(2, "data", "hello", 2),
        );
    });

    it("describes missing keys as string keys that are non-mandatory", () => {
        const documentText = `body: {}`;
        const { commonArgs, bodyMap } = makeBodyMap(documentText);

        parseBodyFromYamlMap(bodyMap, commonArgs);

        const missingKeys = getMissingKeys(commonArgs.mapDescriptors[0]);
        expect(missingKeys).toHaveLength(2);
        for (const missing of missingKeys) {
            expect(missing.valueKinds).toEqual(["string"]);
            expect(missing.isMandatory).toBe(false);
        }
    });
});

function makeBodyMap(documentText: string) {
    const commonArgs = makeCommonParsingArgs(documentText);
    const parsedDocument = parseTextIntoYamlDocument(documentText);
    const innerMap = (parsedDocument.contents as YAMLMap).items[0]
        .value as YAMLMap;
    const bodyMap: WithKeyAndKeyRange<YAMLMap> = {
        key: "body",
        keyRange: getExpectedKeyRange(0, "body", 0),
        value: innerMap,
    };
    return { commonArgs, bodyMap };
}
