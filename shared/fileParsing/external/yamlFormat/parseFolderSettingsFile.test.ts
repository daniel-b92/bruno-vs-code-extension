import { describe, it, expect } from "@jest/globals";
import { TextDocumentHelper } from "../../../fileSystem/textDocumentHelper";
import { parseFolderSettingsFile, Position, Range } from "../../..";
import { getExpectedKeyRange } from "../../../_testingUtils";
import {
    FolderSettingsRequestSectionProperty,
    TopLevelFolderSettingsProperty,
} from "./constants/folderSettingsFileConstants";

describe("parseFolderSettingsFile", () => {
    it("parses valid file with all sections defined", () => {
        const documentText = `info:
  name: test 3
  type: folder

request:
  headers:
    - name: name22
      value: dfgdfg
      description: sdsds
      disabled: true
  auth:
    type: basic
    username: sdgfdg
    password: sdgdfgf
  variables:
    - name: bla
      value: sdfsdfd
      description: sdfs
  actions:
    - type: set-variable
      phase: after-response
      selector:
        expression: sdsd
        method: jsonq
      variable:
        name: dssd
        scope: runtime
      description: sdsd
  scripts:
    - type: before-request
      code: eee

docs:
  content: fghfghfg
  type: text/markdown`;

        const docHelper = new TextDocumentHelper(documentText);
        const { result, errors } = parseFolderSettingsFile(docHelper);

        expect(errors).toHaveLength(0);
        expect(result).toBeDefined();
        expect(result!.missingProperties).toHaveLength(0);
        const properties = result!.properties;

        expect(properties.info).toBeDefined();
        expect(properties.info?.keyRange).toEqual(
            getExpectedKeyRange(0, TopLevelFolderSettingsProperty.Info, 0),
        );
        expect(properties.info?.valueRange).toEqual(
            new Range(new Position(1, 2), new Position(3, 0)),
        );

        expect(properties.request).toBeDefined();
        expect(properties.request?.keyRange).toEqual(
            getExpectedKeyRange(4, TopLevelFolderSettingsProperty.Request, 0),
        );
        expect(properties.request?.valueRange).toEqual(
            new Range(new Position(5, 2), new Position(31, 0)),
        );

        expect(properties.docs).toBeDefined();
        expect(properties.docs?.keyRange).toEqual(
            getExpectedKeyRange(32, TopLevelFolderSettingsProperty.Docs, 0),
        );
        expect(properties.docs?.valueRange).toEqual(
            new Range(new Position(33, 2), docHelper.getTextRange()!.end),
        );
    });

    it("returns an error for an invalid top level key and parses other sections", () => {
        const documentText = `info:
    name: test 3
    type: folder
    
other: erer`;
        const docHelper = new TextDocumentHelper(documentText);
        const { result, errors } = parseFolderSettingsFile(docHelper);

        expect(errors).toHaveLength(1);
        expect(errors[0].range).toEqual(getExpectedKeyRange(4, "other", 0));

        expect(result).toBeDefined();
        expect(result!.missingProperties).toHaveLength(
            Object.values(TopLevelFolderSettingsProperty).length - 1,
        );
        expect(result!.missingProperties).toContainEqual({
            key: TopLevelFolderSettingsProperty.Request,
            isMandatory: false,
            alwaysHasScalarValue: false,
        });
        expect(result!.missingProperties).not.toContain(
            TopLevelFolderSettingsProperty.Info,
        );
        expect(result!.properties.info).toBeDefined();
        expect(result!.properties.info!.properties.name?.value).toBe("test 3");
    });

    it("parses file with some valid and some invalid sections", () => {
        const documentText = `info:
  name: test 3
  typo: folder

request:
  heads:
    - name: name22
      value: dfgdfg
      description: sdsds
      disabled: true
  auth:
    type: 
        - basic
    username: sdgfdg

docs:
  content: fghfghfg`;

        const docHelper = new TextDocumentHelper(documentText);
        const { result, errors } = parseFolderSettingsFile(docHelper);

        expect(errors).toHaveLength(5);
        // Error for invalid property 'typo' in info section.
        expect(
            errors.some(({ range }) =>
                range.equals(getExpectedKeyRange(2, "typo", 2)),
            ),
        ).toBeTruthy();
        // Error for missing mandatory property 'type' in info section.
        expect(
            errors.some(({ range }) =>
                range.equals(new Range(new Position(1, 2), new Position(3, 0))),
            ),
        ).toBeTruthy();
        // Error for invalid property 'heads' in request section.
        expect(
            errors.some(({ range }) =>
                range.equals(getExpectedKeyRange(5, "heads", 2)),
            ),
        ).toBeTruthy();
        // Error for invalid value type for auth type field in request section.
        expect(
            errors.some(({ range }) =>
                range.equals(
                    new Range(new Position(12, 8), new Position(13, 0)),
                ),
            ),
        ).toBeTruthy();
        // Error for missing mandatory property 'type' in docs section.
        expect(
            errors.some(({ range }) =>
                range.equals(
                    new Range(
                        new Position(16, 2),
                        docHelper.getRangeForLine(16)!.end,
                    ),
                ),
            ),
        ).toBeTruthy();

        expect(result).toBeDefined();
        expect(result!.missingProperties).toHaveLength(0);
        const properties = result!.properties;

        expect(properties.info).toBeDefined();
        expect(properties.info?.keyRange).toEqual(
            getExpectedKeyRange(0, TopLevelFolderSettingsProperty.Info, 0),
        );
        expect(properties.info?.valueRange).toEqual(
            new Range(new Position(1, 2), new Position(3, 0)),
        );

        expect(properties.request).toBeDefined();
        expect(properties.request?.keyRange).toEqual(
            getExpectedKeyRange(4, TopLevelFolderSettingsProperty.Request, 0),
        );
        expect(properties.request?.valueRange).toEqual(
            new Range(new Position(5, 2), new Position(14, 0)),
        );
        expect(
            properties.request?.missingProperties.some(
                ({ key }) =>
                    key == FolderSettingsRequestSectionProperty.Headers,
            ),
        ).toBeTruthy();
        expect(properties.request?.properties.auth).toBeUndefined();

        expect(properties.docs).toBeDefined();
        expect(properties.docs?.keyRange).toEqual(
            getExpectedKeyRange(15, TopLevelFolderSettingsProperty.Docs, 0),
        );
        expect(properties.docs?.valueRange).toEqual(
            new Range(new Position(16, 2), docHelper.getTextRange()!.end),
        );
    });
});
