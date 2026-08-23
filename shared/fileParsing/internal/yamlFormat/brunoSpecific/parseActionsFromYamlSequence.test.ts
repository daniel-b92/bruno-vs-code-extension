import { describe, it, expect } from "@jest/globals";
import { YAMLSeq } from "yaml";
import {
    getExpectedKeyRange,
    getExpectedSameLineValueRange,
    parseTextIntoYamlDocument,
} from "../../../../_testingUtils";
import { parseActionsFromYamlSequence } from "./parseActionsFromYamlSequence";
import { Position, Range, TextDocumentHelper } from "../../../..";
import {
    ActionPhase,
    ActionProperty,
} from "../../../external/yamlFormat/constants/actionConstants";

describe("parseActionsFromYamlSequence", () => {
    it("parses single valid enabled action from Yaml sequence", () => {
        const documentText = `- type: set-variable
  phase: after-response
  selector:
    expression: sdsd
    method: jsonq
  variable:
    name: dssd
    scope: runtime
  description: sdsd`;

        const yamlDocument = parseTextIntoYamlDocument(documentText);
        const docHelper = new TextDocumentHelper(documentText);
        const fullDocumentRange = docHelper.getTextRange();
        const { result, errors } = parseActionsFromYamlSequence(
            yamlDocument.contents as YAMLSeq,
            { docHelper, fullDocumentRange },
        );

        expect(errors).toHaveLength(0);
        expect(result).toBeDefined();
        expect(result!.disabled).toHaveLength(0);
        expect(result!.enabled).toHaveLength(1);

        const action = result!.enabled[0];
        expect(action.missingProperties).toHaveLength(1);
        expect(action.missingProperties[0]).toEqual({
            alwaysHasScalarValue: true,
            isMandatory: false,
            key: ActionProperty.Disabled,
        });
        expect(action.valueRange).toEqual(
            new Range(new Position(0, 2), fullDocumentRange.end),
        );

        expect(action.properties.phase?.value).toEqual(
            ActionPhase.AfterResponse,
        );
        expect(action.properties.selector).toEqual({
            missingProperties: [],
            keyRange: getExpectedKeyRange(2, "variable", 2),
            valueRange: new Range(new Position(3, 4), new Position(5, 0)),
            properties: {
                expression: {
                    keyRange: getExpectedKeyRange(3, "expression", 4),
                    valueRange: getExpectedSameLineValueRange(
                        3,
                        "expression",
                        "sdsd",
                        4,
                    ),
                    value: "sdsd",
                },
                method: {
                    keyRange: getExpectedKeyRange(4, "method", 4),
                    valueRange: getExpectedSameLineValueRange(
                        4,
                        "method",
                        "jsonq",
                        4,
                    ),
                    value: "jsonq",
                },
            },
        });

        expect(action.properties.variable).toEqual({
            missingProperties: [],
            keyRange: getExpectedKeyRange(5, "selector", 2),
            valueRange: new Range(new Position(6, 4), new Position(8, 0)),
            properties: {
                name: {
                    keyRange: getExpectedKeyRange(6, "name", 4),
                    valueRange: getExpectedSameLineValueRange(
                        6,
                        "name",
                        "dssd",
                        4,
                    ),
                    value: "dssd",
                },
                scope: {
                    keyRange: getExpectedKeyRange(7, "scope", 4),
                    valueRange: getExpectedSameLineValueRange(
                        7,
                        "scope",
                        "runtime",
                        4,
                    ),
                    value: "runtime",
                },
            },
        });

        expect(action.properties.description?.value).toBe("sdsd");
        expect(action.properties.description?.keyRange).toEqual(
            getExpectedKeyRange(8, "description", 2),
        );
        expect(action.properties.description?.valueRange).toEqual(
            getExpectedSameLineValueRange(8, "description", "sdsd", 2),
        );
    });

    it("parses multiple enabled and disabled actions from Yaml sequence", () => {
        const documentText = `- type: set-variable
  phase: after-response
  selector:
    expression: |
      adasda
      asdasd
      asd
    method: jsonq
  variable:
    name: dssd
    scope: runtime
  description: enabled-1
- type: set-variable
  phase: after-response
  selector:
    expression: asdgdssdfsfdqw
    method: jsonq
  variable:
    name: rrrrr
    scope: runtime
  description: disabled-1
  disabled: true
- type: set-variable
  phase: after-response
  selector:
    expression: erebdfg
    method: jsonq
  variable:
    name: ztuttur
    scope: runtime
  description: enabled-2
  disabled: false`;

        const yamlDocument = parseTextIntoYamlDocument(documentText);
        const docHelper = new TextDocumentHelper(documentText);
        const fullDocumentRange = docHelper.getTextRange();
        const { result, errors } = parseActionsFromYamlSequence(
            yamlDocument.contents as YAMLSeq,
            { docHelper, fullDocumentRange },
        );

        expect(errors).toHaveLength(0);
        expect(result).toBeDefined();
        expect(result!.disabled).toHaveLength(1);
        expect(result!.enabled).toHaveLength(2);

        expect(result!.disabled[0].properties.description?.value).toEqual(
            "disabled-1",
        );
        expect(
            result!.enabled.some(
                ({ properties: { description } }) =>
                    description?.value == "enabled-1",
            ),
        ).toBeTruthy();
        expect(
            result!.enabled.some(
                ({ properties: { description } }) =>
                    description?.value == "enabled-2",
            ),
        ).toBeTruthy();
    });

    it("partially parses single invalid action from Yaml sequence", () => {
        const documentText = `- type: set-variables
  selector: dunno
  variable:
    name: dssd
    scope: runtime`;

        const yamlDocument = parseTextIntoYamlDocument(documentText);
        const docHelper = new TextDocumentHelper(documentText);
        const fullDocumentRange = docHelper.getTextRange();
        const { result, errors } = parseActionsFromYamlSequence(
            yamlDocument.contents as YAMLSeq,
            { docHelper, fullDocumentRange },
        );

        expect(errors).toHaveLength(3);
        // Error for invalid value for 'type'
        expect(
            errors.some(({ range }) =>
                range.equals(
                    new Range(
                        new Position(0, 8),
                        docHelper.getRangeForLine(0)!.end,
                    ),
                ),
            ),
        ).toBeTruthy();
        // Error for missing mandatory key 'phase'.
        expect(
            errors.some(({ range }) =>
                range.equals(
                    new Range(new Position(0, 2), fullDocumentRange.end),
                ),
            ),
        ).toBeTruthy();
        // Error for invalid value type for property 'selector' (should be map but is scalar).
        expect(
            errors.some(({ range }) =>
                range.equals(
                    getExpectedSameLineValueRange(1, "selector", "dunno", 2),
                ),
            ),
        ).toBeTruthy();
        expect(result).toBeDefined();
        expect(result!.disabled).toHaveLength(0);
        expect(result!.enabled).toHaveLength(1);

        const action = result!.enabled[0];
        expect(action.missingProperties).toHaveLength(3);
        expect(action.properties.selector).toBeUndefined();

        expect(action.properties.variable?.properties.name?.value).toEqual(
            "dssd",
        );
    });
});
