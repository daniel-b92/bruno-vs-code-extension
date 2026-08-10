import { describe, it, expect } from "@jest/globals";
import { TextDocumentHelper } from "../../../fileSystem/textDocumentHelper";
import { ParsedInfo } from "./interfaces";
import { parseInfoFromYamlFile, Position, Range } from "../../..";
import {
    FileInfoProperty,
    FileInfoType,
    TopLevelRequestOrFolderSettingsProperty,
} from "../../internal/yamlFormat/interfaces";
import {
    getExpectedKeyRange,
    getExpectedSameLineValueRange,
} from "../../../_testingUtils";

describe("parseInfoFromYamlFile", () => {
    it("parses an info block from a valid simple request file", () => {
        const documentText = `info:
    name: test 3
    type: http
    seq: 3
    tags:
        - tag-1
        - tag-2

http:
    method: GET
    url: bla
    auth: inherit`;
        const parsed = parseInfoFromYamlFile(
            new TextDocumentHelper(documentText),
        );

        const nameLine = 1;

        const expectedInfo: ParsedInfo = {
            keyRange: new Range(
                new Position(0, 0),
                new Position(
                    0,
                    TopLevelRequestOrFolderSettingsProperty.Info.length,
                ),
            ),
            valueRange: new Range(new Position(1, 4), new Position(7, 0)),
            value: {
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
                    value: FileInfoType.Http,
                    valueRange: getExpectedSameLineValueRange(
                        nameLine + 1,
                        FileInfoProperty.Type,
                        FileInfoType.Http,
                    ),
                },
                sequence: {
                    keyRange: getExpectedKeyRange(
                        nameLine + 2,
                        FileInfoProperty.Seq,
                    ),
                    value: 3,
                    valueRange: getExpectedSameLineValueRange(
                        nameLine + 2,
                        FileInfoProperty.Seq,
                        "3",
                    ),
                },
                tags: {
                    keyRange: getExpectedKeyRange(
                        nameLine + 3,
                        FileInfoProperty.Tags,
                    ),
                    value: [
                        {
                            value: "tag-1",
                            range: getExpectedKeyRange(
                                nameLine + 4,
                                "tag-1",
                                10,
                            ),
                        },
                        {
                            value: "tag-2",
                            range: getExpectedKeyRange(
                                nameLine + 5,
                                "tag-2",
                                10,
                            ),
                        },
                    ],
                    valueRange: new Range(
                        new Position(nameLine + 4, 8),
                        new Position(nameLine + 4 + 2, 0),
                    ),
                },
            },
        };

        expect(parsed).toEqual({
            info: expectedInfo,
            errors: [],
        });
    });
});
