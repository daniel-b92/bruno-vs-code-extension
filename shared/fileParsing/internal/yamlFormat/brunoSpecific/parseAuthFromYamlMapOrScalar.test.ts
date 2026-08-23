import { describe, it, expect } from "@jest/globals";
import {
    getExpectedKeyRange,
    getExpectedSameLineValueRange,
    parseTextIntoYamlDocument,
} from "../../../../_testingUtils";
import { Position, Range, TextDocumentHelper } from "../../../..";
import { parseAuthFromYamlMapOrScalar } from "./parseAuthFromYamlMapOrScalar";
import {
    ParsedBasicAuth,
    WithKeyAndKeyRange,
    WithKeyKeyRangeAndValueRange,
} from "../interfaces";
import { YAMLMap } from "yaml";
import {
    AuthType,
    BasicAuthProperty,
} from "../../../external/yamlFormat/constants/authConstants";

describe("parseAuthFromYamlMapOrScalar", () => {
    it("parses auth of type 'inherit'", () => {
        const documentText = `auth: inherit`;

        const source: WithKeyKeyRangeAndValueRange<string> = {
            key: "auth",
            keyRange: getExpectedKeyRange(0, "auth", 0),
            value: "inherit",
            valueRange: getExpectedSameLineValueRange(0, "auth", "inherit", 0),
        };
        const docHelper = new TextDocumentHelper(documentText);
        const fullDocumentRange = docHelper.getTextRange();
        const { result, errors } = parseAuthFromYamlMapOrScalar({
            authMapOrScalar: source,
            commonArgs: { docHelper, fullDocumentRange },
        });

        expect(errors).toHaveLength(0);
        expect(result).toBeDefined();
        expect(result?.keyRange).toEqual(source.keyRange);
        expect(result?.valueRange).toEqual(source.valueRange);
        expect(result?.value).toEqual({});
    });

    it("returns an error for invalid scalar value", () => {
        const documentText = `auth: inherits`;

        const source: WithKeyKeyRangeAndValueRange<string> = {
            key: "auth",
            keyRange: getExpectedKeyRange(0, "auth", 0),
            value: "inherits",
            valueRange: getExpectedSameLineValueRange(0, "auth", "inherits", 0),
        };
        const docHelper = new TextDocumentHelper(documentText);
        const fullDocumentRange = docHelper.getTextRange();
        const { result, errors } = parseAuthFromYamlMapOrScalar({
            authMapOrScalar: source,
            commonArgs: { docHelper, fullDocumentRange },
        });

        expect(errors).toHaveLength(1);
        expect(errors[0].range).toEqual(
            getExpectedSameLineValueRange(0, "auth", "inherits", 0),
        );
        expect(result).toBeUndefined();
    });

    it("parses auth of type 'basic'", () => {
        const documentText = `auth:
    type: basic
    username: sdgfdg
    password: sdgdfgf`;

        const docHelper = new TextDocumentHelper(documentText);
        const fullDocumentRange = docHelper.getTextRange();
        const parsedDocument = parseTextIntoYamlDocument(documentText);
        const authMap = (parsedDocument.contents as YAMLMap).items[0]
            .value as YAMLMap;
        const source: WithKeyAndKeyRange<YAMLMap> = {
            key: "auth",
            keyRange: getExpectedKeyRange(0, "auth", 0),
            value: authMap,
        };

        const { result, errors } = parseAuthFromYamlMapOrScalar({
            authMapOrScalar: source,
            commonArgs: { docHelper, fullDocumentRange },
        });

        expect(errors).toHaveLength(0);
        expect(result).toBeDefined();
        expect(result?.keyRange).toEqual(source.keyRange);

        const expectedValue: ParsedBasicAuth = {
            missingProperties: [],
            properties: {
                type: {
                    keyRange: getExpectedKeyRange(1, BasicAuthProperty.Type, 4),
                    valueRange: getExpectedSameLineValueRange(
                        1,
                        BasicAuthProperty.Type,
                        AuthType.Basic,
                        4,
                    ),
                    value: AuthType.Basic,
                },
                username: {
                    keyRange: getExpectedKeyRange(
                        2,
                        BasicAuthProperty.Username,
                        4,
                    ),
                    valueRange: getExpectedSameLineValueRange(
                        2,
                        BasicAuthProperty.Username,
                        "sdgfdg",
                        4,
                    ),
                    value: "sdgfdg",
                },
                password: {
                    keyRange: getExpectedKeyRange(
                        3,
                        BasicAuthProperty.Password,
                        4,
                    ),
                    valueRange: getExpectedSameLineValueRange(
                        3,
                        BasicAuthProperty.Password,
                        "sdgdfgf",
                        4,
                    ),
                    value: "sdgdfgf",
                },
            },
        };
        expect(result?.value).toEqual(expectedValue);
    });

    it("partially parses auth of type 'basic' containing invalid properties", () => {
        const documentText = `auth:
    type: basic
    username: 
        username : ererer
    password: sdgdfgf
    asasas: 54545`;

        const docHelper = new TextDocumentHelper(documentText);
        const fullDocumentRange = docHelper.getTextRange();
        const parsedDocument = parseTextIntoYamlDocument(documentText);
        const authMap = (parsedDocument.contents as YAMLMap).items[0]
            .value as YAMLMap;
        const source: WithKeyAndKeyRange<YAMLMap> = {
            key: "auth",
            keyRange: getExpectedKeyRange(0, "auth", 0),
            value: authMap,
        };

        const { result, errors } = parseAuthFromYamlMapOrScalar({
            authMapOrScalar: source,
            commonArgs: { docHelper, fullDocumentRange },
        });

        expect(errors).toHaveLength(2);
        // Error for invalid value type for 'username' property.
        expect(
            errors.some(({ range }) =>
                range.equals(new Range(new Position(3, 8), new Position(4, 0))),
            ),
        ).toBeTruthy();
        // Error for unknown key.
        expect(
            errors.some(({ range }) =>
                range.equals(getExpectedKeyRange(5, "asasas", 4)),
            ),
        ).toBeTruthy();

        expect(result).toBeDefined();
        const auth = result?.value as ParsedBasicAuth;
        expect(auth.missingProperties).toHaveLength(0);
        expect(auth.properties.username).toBeUndefined();
        expect(auth.properties.password).toEqual({
            keyRange: getExpectedKeyRange(4, BasicAuthProperty.Password, 4),
            valueRange: getExpectedSameLineValueRange(
                4,
                BasicAuthProperty.Password,
                "sdgdfgf",
                4,
            ),
            value: "sdgdfgf",
        });
    });
});
