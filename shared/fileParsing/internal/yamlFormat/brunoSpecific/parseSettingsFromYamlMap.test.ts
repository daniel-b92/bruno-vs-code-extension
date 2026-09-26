import { describe, it, expect } from "@jest/globals";
import {
    getExpectedKeyRange,
    getExpectedSameLineValueRange,
    parseTextIntoYamlDocument,
} from "../../../../_testingUtils";
import { TextDocumentHelper } from "../../../..";
import { YAMLMap } from "yaml";
import { WithKeyAndKeyRange } from "../interfaces";
import { parseSettingsFromYamlMap } from "./parseSettingsFromYamlMap";
import { RequestFileSettingsProperty } from "../../../external/yamlFormat/constants/requestFileConstants";

describe("parseSettingsFromYamlMap", () => {
    it("parses all boolean settings fields", () => {
        const documentText = `settings:
    encodeUrl: true
    followRedirects: false
    forwardAuthorizationHeader: true
    maxRedirects: 5
    timeout: 5000`;

        const { commonArgs, settingsMap } = makeSettingsMap(documentText);
        const { result, errors } = parseSettingsFromYamlMap(
            settingsMap,
            commonArgs,
        );

        expect(errors).toHaveLength(0);
        expect(result.properties.encodeUrl?.value).toBe(true);
        expect(result.properties.followRedirects?.value).toBe(false);
        expect(result.properties.forwardAuthorizationHeader?.value).toBe(true);
    });

    it("parses numeric timeout", () => {
        const documentText = `settings:
    encodeUrl: true
    followRedirects: true
    forwardAuthorizationHeader: true
    maxRedirects: 5
    timeout: 5000`;

        const { commonArgs, settingsMap } = makeSettingsMap(documentText);
        const { result, errors } = parseSettingsFromYamlMap(
            settingsMap,
            commonArgs,
        );

        expect(errors).toHaveLength(0);
        expect(result.properties.timeout).toBeDefined();
        const timeout = result.properties.timeout;
        expect(timeout && "value" in timeout ? timeout.value : undefined).toBe(
            5000,
        );
    });

    it("parses timeout as the string 'inherit'", () => {
        const documentText = `settings:
    encodeUrl: true
    followRedirects: true
    forwardAuthorizationHeader: true
    maxRedirects: 5
    timeout: inherit`;

        const { commonArgs, settingsMap } = makeSettingsMap(documentText);
        const { result, errors } = parseSettingsFromYamlMap(
            settingsMap,
            commonArgs,
        );

        expect(errors).toHaveLength(0);
        expect(result.properties.timeout).toBeDefined();
        expect(result.properties.timeout?.value).toBe("inherit");
    });

    it("reports an error for an invalid string timeout value", () => {
        const documentText = `settings:
    encodeUrl: true
    followRedirects: true
    forwardAuthorizationHeader: true
    maxRedirects: 5
    timeout: not-a-valid-value`;

        const { commonArgs, settingsMap } = makeSettingsMap(documentText);
        const { result, errors } = parseSettingsFromYamlMap(
            settingsMap,
            commonArgs,
        );

        expect(errors).toHaveLength(1);
        expect(result.properties.timeout).toBeUndefined();
    });

    it("parses maxRedirects as a numeric scalar", () => {
        const documentText = `settings:
    encodeUrl: true
    followRedirects: true
    forwardAuthorizationHeader: true
    maxRedirects: 10
    timeout: 5000`;

        const { commonArgs, settingsMap } = makeSettingsMap(documentText);
        const { result, errors } = parseSettingsFromYamlMap(
            settingsMap,
            commonArgs,
        );

        expect(errors).toHaveLength(0);
        expect(result.properties.maxRedirects?.value).toBe(10);
    });

    it("reports error for unknown keys", () => {
        const documentText = `settings:
    encodeUrl: true
    followRedirects: true
    forwardAuthorizationHeader: true
    maxRedirects: 5
    timeout: 5000
    unknownSetting: value`;

        const { commonArgs, settingsMap } = makeSettingsMap(documentText);
        const { errors } = parseSettingsFromYamlMap(settingsMap, commonArgs);

        expect(errors).toHaveLength(1);
        expect(errors[0].range).toEqual(
            getExpectedKeyRange(6, "unknownSetting", 4),
        );
    });

    it("returns undefined properties when settings map is empty", () => {
        const documentText = `settings: {}`;

        const { commonArgs, settingsMap } = makeSettingsMap(documentText);
        const { result, errors } = parseSettingsFromYamlMap(
            settingsMap,
            commonArgs,
        );

        expect(errors).toHaveLength(5);
        expect(result.properties.encodeUrl).toBeUndefined();
        expect(result.properties.followRedirects).toBeUndefined();
        expect(result.properties.forwardAuthorizationHeader).toBeUndefined();
        expect(result.properties.maxRedirects).toBeUndefined();
        expect(result.properties.timeout).toBeUndefined();
    });

    it("produces correct keyRange and valueRange on the result", () => {
        const documentText = `settings:
    encodeUrl: true`;

        const { commonArgs, settingsMap } = makeSettingsMap(documentText);
        const { result } = parseSettingsFromYamlMap(settingsMap, commonArgs);

        expect(result.keyRange).toEqual(
            getExpectedKeyRange(0, "settings", 0),
        );
        expect(result.valueRange).toBeDefined();
    });

    it("returns correct keyRange and valueRange for a boolean field", () => {
        const documentText = `settings:
    encodeUrl: true`;

        const { commonArgs, settingsMap } = makeSettingsMap(documentText);
        const { result } = parseSettingsFromYamlMap(settingsMap, commonArgs);

        expect(result.properties.encodeUrl?.keyRange).toEqual(
            getExpectedKeyRange(1, RequestFileSettingsProperty.EncodeUrl, 4),
        );
        expect(result.properties.encodeUrl?.valueRange).toEqual(
            getExpectedSameLineValueRange(
                1,
                RequestFileSettingsProperty.EncodeUrl,
                "true",
                4,
            ),
        );
    });

    it("returns correct keyRange for maxRedirects", () => {
        const documentText = `settings:
    maxRedirects: 5`;

        const { commonArgs, settingsMap } = makeSettingsMap(documentText);
        const { result } = parseSettingsFromYamlMap(settingsMap, commonArgs);

        expect(result.properties.maxRedirects?.keyRange).toEqual(
            getExpectedKeyRange(1, RequestFileSettingsProperty.MaxRedirects, 4),
        );
    });
});

function makeSettingsMap(documentText: string) {
    const docHelper = new TextDocumentHelper(documentText);
    const commonArgs = { docHelper, fullDocumentRange: docHelper.getTextRange() };
    const parsedDocument = parseTextIntoYamlDocument(documentText);
    const innerMap = (parsedDocument.contents as YAMLMap).items[0]
        .value as YAMLMap;
    const settingsMap: WithKeyAndKeyRange<YAMLMap> = {
        key: "settings",
        keyRange: getExpectedKeyRange(0, "settings", 0),
        value: innerMap,
    };
    return { commonArgs, settingsMap };
}
