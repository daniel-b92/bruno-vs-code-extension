import { describe, it, expect } from "@jest/globals";
import {
    getExpectedKeyRange,
    parseTextIntoYamlDocument,
} from "../../../../_testingUtils";
import { Position, Range, TextDocumentHelper } from "../../../..";
import { YAMLSeq } from "yaml";
import {
    ScriptMapProperty,
    ScriptType,
} from "../../../external/yamlFormat/constants/sharedConstants";
import { parseScriptsFromYamlSequence } from "./parseScriptsFromYamlSequence";

describe("parseScriptsFromYamlSequence", () => {
    it("parses single script entry from Yaml sequence", () => {
        const documentText = `-   type: before-request
    code: |-
        sdcsdcdscdscsdsvfs
        scdasdasfdasdas`;

        const docHelper = new TextDocumentHelper(documentText);
        const fullDocumentRange = docHelper.getTextRange();
        const parsedDocument = parseTextIntoYamlDocument(documentText);
        const sequence = parsedDocument.contents as YAMLSeq;
        const { result, errors } = parseScriptsFromYamlSequence(sequence, {
            docHelper,
            fullDocumentRange,
        });

        expect(errors).toHaveLength(0);
        expect(result).toBeDefined();
        expect(result).toHaveLength(1);
        const script = result![0];
        expect(script.missingProperties).toHaveLength(0);
        expect(script.valueRange).toEqual(
            new Range(new Position(0, 4), fullDocumentRange.end),
        );
        const expectedProperties = {
            type: {
                keyRange: new Range(new Position(0, 4), new Position(0, 8)),
                valueRange: new Range(
                    new Position(0, 8 + 2),
                    docHelper.getRangeForLine(0)!.end,
                ),
                value: ScriptType.BeforeRequest,
            },
            code: {
                keyRange: getExpectedKeyRange(1, ScriptMapProperty.Code, 4),
                valueRange: new Range(
                    new Position(1, 4 + "code: ".length),
                    fullDocumentRange.end,
                ),
                value: "sdcsdcdscdscsdsvfs\nscdasdasfdasdas",
            },
        };
        expect(script.properties).toEqual(expectedProperties);
    });

    it("parses multiple script entries from Yaml sequence", () => {
        const documentText = `-   type: before-request
    code: eee
-   type: after-response
    code: bru.setEnvVar("bla", "bli");
-   type: tests
    code: expect(res.getStatus()).to.eql(200);`;

        const docHelper = new TextDocumentHelper(documentText);
        const fullDocumentRange = docHelper.getTextRange();
        const parsedDocument = parseTextIntoYamlDocument(documentText);
        const sequence = parsedDocument.contents as YAMLSeq;
        const { result, errors } = parseScriptsFromYamlSequence(sequence, {
            docHelper,
            fullDocumentRange,
        });

        expect(errors).toHaveLength(0);
        expect(result).toBeDefined();
        expect(result).toHaveLength(3);
        const beforeRequestScript = result?.find(
            ({ properties: { type } }) =>
                type?.value == ScriptType.BeforeRequest,
        );
        const afterResponseScript = result?.find(
            ({ properties: { type } }) =>
                type?.value == ScriptType.AfterResponse,
        );
        const testsScript = result?.find(
            ({ properties: { type } }) => type?.value == ScriptType.Tests,
        );
        expect(beforeRequestScript).toBeDefined();
        expect(afterResponseScript).toBeDefined();
        expect(testsScript).toBeDefined();
        expect(beforeRequestScript?.valueRange).toEqual(
            new Range(new Position(0, 4), new Position(2, 0)),
        );
        expect(afterResponseScript?.valueRange).toEqual(
            new Range(new Position(2, 4), new Position(4, 0)),
        );
        expect(testsScript?.valueRange).toEqual(
            new Range(new Position(4, 4), docHelper.getRangeForLine(5)!.end),
        );
    });

    it("partially parses script containing invalid properties", () => {
        const documentText = `-   type: other
    code: eee
    eeeee: ttttt`;

        const docHelper = new TextDocumentHelper(documentText);
        const fullDocumentRange = docHelper.getTextRange();
        const parsedDocument = parseTextIntoYamlDocument(documentText);
        const sequence = parsedDocument.contents as YAMLSeq;
        const { result, errors } = parseScriptsFromYamlSequence(sequence, {
            docHelper,
            fullDocumentRange,
        });

        expect(errors).toHaveLength(2);
        // Error for invalid value for property 'type'.
        expect(
            errors.some(({ range }) =>
                range.equals(
                    new Range(
                        new Position(0, 10),
                        docHelper.getRangeForLine(0)!.end,
                    ),
                ),
            ),
        ).toBeTruthy();
        // Error for invalid key 'eeeee'.
        expect(
            errors.some(({ range }) =>
                range.equals(getExpectedKeyRange(2, "eeeee", 4)),
            ),
        ).toBeTruthy();

        expect(result).toBeDefined();
        expect(result).toHaveLength(1);
        const script = result![0];
        expect(script.missingProperties).toHaveLength(0);
        expect(script.valueRange).toEqual(
            new Range(new Position(0, 4), fullDocumentRange.end),
        );
        expect(script.properties.code?.value).toBe("eee");
    });
});
