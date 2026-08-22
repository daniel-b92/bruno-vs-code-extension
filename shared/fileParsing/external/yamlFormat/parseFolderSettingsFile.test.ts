import { describe, it, expect } from "@jest/globals";
import { TextDocumentHelper } from "../../../fileSystem/textDocumentHelper";
import { ParsedInfoForFolderSettings } from "./interfaces";
import { parseFolderSettingsFile, Position, Range } from "../../..";
import {
    getExpectedKeyRange,
    getExpectedSameLineValueRange,
} from "../../../_testingUtils";
import { TopLevelRequestFileProperty } from "./constants/requestFileConstants";
import { FileInfoProperty, FileInfoType } from "./constants/sharedConstants";
import { TopLevelFolderSettingsProperty } from "./constants/folderSettingsFileConstants";

describe("parseFolderSettingsFile", () => {
    it("parses valid file with minimal data", () => {
        const documentText = `info:
    name: test 3
    type: folder`;

        const nameLine = 1;

        const expectedInfo: ParsedInfoForFolderSettings = {
            keyRange: new Range(
                new Position(0, 0),
                new Position(0, TopLevelRequestFileProperty.Info.length),
            ),
            valueRange: new Range(
                new Position(1, 4),
                getExpectedSameLineValueRange(2, "type", "folder", 4).end,
            ),
            missingProperties: [
                {
                    key: FileInfoProperty.Seq,
                    isMandatory: false,
                    alwaysHasScalarValue: true,
                },
            ],
            properties: {
                name: {
                    keyRange: getExpectedKeyRange(
                        nameLine,
                        FileInfoProperty.Name,
                    ),
                    value: "test 3",
                    valueRange: getExpectedSameLineValueRange(
                        nameLine,
                        FileInfoProperty.Name,
                        "test 3",
                    ),
                },
                type: {
                    keyRange: getExpectedKeyRange(
                        nameLine + 1,
                        FileInfoProperty.Type,
                    ),
                    value: FileInfoType.Folder,
                    valueRange: getExpectedSameLineValueRange(
                        nameLine + 1,
                        FileInfoProperty.Type,
                        FileInfoType.Folder,
                    ),
                },
                sequence: undefined,
            },
        };

        const { result, errors } = parseFolderSettingsFile(
            new TextDocumentHelper(documentText),
        );

        expect(errors).toHaveLength(0);
        expect(result).toBeDefined();
        expect(result!.missingProperties).toHaveLength(
            Object.values(TopLevelFolderSettingsProperty).length - 1,
        );
        expect(result!.properties.info as ParsedInfoForFolderSettings).toEqual(
            expectedInfo,
        );
    });

    it("returns an error for an invalid top level key and partially parses other sections", () => {
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
});
