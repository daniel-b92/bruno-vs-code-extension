import { describe, it, expect } from "@jest/globals";
import {
    getExpectedKeyRange,
    getExpectedSameLineValueRange,
    parseTextIntoYamlDocument,
} from "../../../../_testingUtils";
import { BrunoFileType, TextDocumentHelper } from "../../../..";
import { YAMLMap } from "yaml";
import { WithKeyAndKeyRange } from "../interfaces";
import { parseFileInfoFromYamlMap } from "./parseFileInfoFromYamlMap";
import {
    FileInfoProperty,
    FileInfoType,
} from "../../../external/yamlFormat/constants/sharedConstants";

describe("parseFileInfoFromYamlMap", () => {
    describe("RequestFile", () => {
        it("parses a complete info block with name, type, seq, and tags", () => {
            const documentText = `info:
    name: My Request
    type: http
    seq: 2
    tags:
        - tag-a
        - tag-b`;

            const { commonArgs, infoMap } = makeInfoMap(documentText);
            const { result, errors } = parseFileInfoFromYamlMap({
                commonArgs,
                fileType: BrunoFileType.RequestFile,
                infoMap,
            });

            expect(errors).toHaveLength(0);
            expect(result!.properties.name?.value).toBe("My Request");
            expect(result!.properties.type?.value).toBe(FileInfoType.Http);
            expect(result!.properties.sequence?.value).toBe(2);
            expect(result!.properties.tags?.value).toHaveLength(2);
            expect(result!.properties.tags?.value[0].value).toBe("tag-a");
            expect(result!.properties.tags?.value[1].value).toBe("tag-b");
            expect(result!.missingProperties).toHaveLength(0);
        });

        it("parses a minimal request file info block (name, type, seq only)", () => {
            const documentText = `info:
    name: My Request
    type: graphql
    seq: 1`;

            const { commonArgs, infoMap } = makeInfoMap(documentText);
            const { result, errors } = parseFileInfoFromYamlMap({
                commonArgs,
                fileType: BrunoFileType.RequestFile,
                infoMap,
            });

            expect(errors).toHaveLength(0);
            expect(result!.properties.name?.value).toBe("My Request");
            expect(result!.properties.type?.value).toBe(FileInfoType.Graphql);
            expect(result!.properties.sequence?.value).toBe(1);
            expect(result!.properties.tags).toBeUndefined();
        });

        it("reports error for unknown key and still parses valid keys", () => {
            const documentText = `info:
    name: My Request
    type: http
    seq: 1
    unknown: value`;

            const { commonArgs, infoMap } = makeInfoMap(documentText);
            const { result, errors } = parseFileInfoFromYamlMap({
                commonArgs,
                fileType: BrunoFileType.RequestFile,
                infoMap,
            });

            expect(errors).toHaveLength(1);
            expect(errors[0].range).toEqual(getExpectedKeyRange(4, "unknown", 4));
            expect(result!.properties.name?.value).toBe("My Request");
        });

        it("reports error for missing mandatory keys (name, type, seq)", () => {
            const documentText = `info: {}`;

            const { commonArgs, infoMap } = makeInfoMap(documentText);
            const { result, errors } = parseFileInfoFromYamlMap({
                commonArgs,
                fileType: BrunoFileType.RequestFile,
                infoMap,
            });

            expect(errors).toHaveLength(3);
            expect(
                result!.missingProperties.some(
                    ({ key, isMandatory }) =>
                        key === FileInfoProperty.Name && isMandatory,
                ),
            ).toBe(true);
            expect(
                result!.missingProperties.some(
                    ({ key, isMandatory }) =>
                        key === FileInfoProperty.Type && isMandatory,
                ),
            ).toBe(true);
            expect(
                result!.missingProperties.some(
                    ({ key, isMandatory }) =>
                        key === FileInfoProperty.Seq && isMandatory,
                ),
            ).toBe(true);
        });

        it("reports error for seq value of zero and returns undefined sequence", () => {
            const documentText = `info:
    name: My Request
    type: http
    seq: 0`;

            const { commonArgs, infoMap } = makeInfoMap(documentText);
            const { result, errors } = parseFileInfoFromYamlMap({
                commonArgs,
                fileType: BrunoFileType.RequestFile,
                infoMap,
            });

            expect(errors).toHaveLength(1);
            expect(result!.properties.sequence).toBeUndefined();
        });

        it("reports error for negative seq value and returns undefined sequence", () => {
            const documentText = `info:
    name: My Request
    type: http
    seq: -1`;

            const { commonArgs, infoMap } = makeInfoMap(documentText);
            const { result, errors } = parseFileInfoFromYamlMap({
                commonArgs,
                fileType: BrunoFileType.RequestFile,
                infoMap,
            });

            expect(errors).toHaveLength(1);
            expect(result!.properties.sequence).toBeUndefined();
        });

        it("reports error for invalid type value", () => {
            const documentText = `info:
    name: My Request
    type: invalid-type
    seq: 1`;

            const { commonArgs, infoMap } = makeInfoMap(documentText);
            const { result, errors } = parseFileInfoFromYamlMap({
                commonArgs,
                fileType: BrunoFileType.RequestFile,
                infoMap,
            });

            expect(errors).toHaveLength(1);
            expect(result!.properties.type).toBeUndefined();
        });

        it("reports error when tags contains non-string values", () => {
            const documentText = `info:
    name: My Request
    type: http
    seq: 1
    tags:
        - key: nested`;

            const { commonArgs, infoMap } = makeInfoMap(documentText);
            const { result, errors } = parseFileInfoFromYamlMap({
                commonArgs,
                fileType: BrunoFileType.RequestFile,
                infoMap,
            });

            expect(errors).toHaveLength(1);
            expect(result!.properties.tags).toBeUndefined();
        });

        it("returns correct keyRange and valueRange", () => {
            const documentText = `info:
    name: My Request
    type: http
    seq: 1`;

            const { commonArgs, infoMap } = makeInfoMap(documentText);
            const { result } = parseFileInfoFromYamlMap({
                commonArgs,
                fileType: BrunoFileType.RequestFile,
                infoMap,
            });

            expect(result!.keyRange).toEqual(getExpectedKeyRange(0, "info", 0));
            expect(result!.valueRange).toBeDefined();
        });

        it("returns correct keyRange and valueRange for name field", () => {
            const documentText = `info:
    name: My Request
    type: http
    seq: 1`;

            const { commonArgs, infoMap } = makeInfoMap(documentText);
            const { result } = parseFileInfoFromYamlMap({
                commonArgs,
                fileType: BrunoFileType.RequestFile,
                infoMap,
            });

            expect(result!.properties.name?.keyRange).toEqual(
                getExpectedKeyRange(1, FileInfoProperty.Name, 4),
            );
            expect(result!.properties.name?.valueRange).toEqual(
                getExpectedSameLineValueRange(
                    1,
                    FileInfoProperty.Name,
                    "My Request",
                    4,
                ),
            );
        });
    });

    describe("FolderSettingsFile", () => {
        it("parses a complete folder settings info block (name and type, no seq or tags)", () => {
            const documentText = `info:
    name: My Folder
    type: folder`;

            const { commonArgs, infoMap } = makeInfoMap(documentText);
            const { result, errors } = parseFileInfoFromYamlMap({
                commonArgs,
                fileType: BrunoFileType.FolderSettingsFile,
                infoMap,
            });

            expect(errors).toHaveLength(0);
            expect(result!.properties.name?.value).toBe("My Folder");
            expect(result!.properties.type?.value).toBe(FileInfoType.Folder);
            expect(result!.properties.sequence).toBeUndefined();
            expect(result!.properties.tags).toBeUndefined();
        });

        it("reports error for missing mandatory keys (name, type) for folder settings file", () => {
            const documentText = `info: {}`;

            const { commonArgs, infoMap } = makeInfoMap(documentText);
            const { result, errors } = parseFileInfoFromYamlMap({
                commonArgs,
                fileType: BrunoFileType.FolderSettingsFile,
                infoMap,
            });

            expect(errors).toHaveLength(2);
            expect(
                result!.missingProperties.some(
                    ({ key, isMandatory }) =>
                        key === FileInfoProperty.Name && isMandatory,
                ),
            ).toBe(true);
            expect(
                result!.missingProperties.some(
                    ({ key, isMandatory }) =>
                        key === FileInfoProperty.Type && isMandatory,
                ),
            ).toBe(true);
        });

        it("parses seq for folder settings file (allowed but not mandatory)", () => {
            const documentText = `info:
    name: My Folder
    type: folder
    seq: 3`;

            const { commonArgs, infoMap } = makeInfoMap(documentText);
            const { result, errors } = parseFileInfoFromYamlMap({
                commonArgs,
                fileType: BrunoFileType.FolderSettingsFile,
                infoMap,
            });

            expect(errors).toHaveLength(0);
            expect(result!.properties.sequence?.value).toBe(3);
        });
    });

    describe("AppFile", () => {
        it("parses an app file info block (name and type, no seq or tags)", () => {
            const documentText = `info:
    name: My App
    type: folder`;

            const { commonArgs, infoMap } = makeInfoMap(documentText);
            const { result, errors } = parseFileInfoFromYamlMap({
                commonArgs,
                fileType: BrunoFileType.AppFile,
                infoMap,
            });

            expect(errors).toHaveLength(0);
            expect(result!.properties.name?.value).toBe("My App");
            expect(result!.properties.sequence).toBeUndefined();
            expect(result!.properties.tags).toBeUndefined();
        });
    });
});

function makeInfoMap(documentText: string) {
    const docHelper = new TextDocumentHelper(documentText);
    const commonArgs = { docHelper, fullDocumentRange: docHelper.getTextRange() };
    const parsedDocument = parseTextIntoYamlDocument(documentText);
    const innerMap = (parsedDocument.contents as YAMLMap).items[0]
        .value as YAMLMap;
    const infoMap: WithKeyAndKeyRange<YAMLMap> = {
        key: "info",
        keyRange: getExpectedKeyRange(0, "info", 0),
        value: innerMap,
    };
    return { commonArgs, infoMap };
}
