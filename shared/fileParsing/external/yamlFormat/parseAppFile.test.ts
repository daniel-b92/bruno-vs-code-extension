import { describe, it, expect } from "@jest/globals";
import { TextDocumentHelper } from "../../../fileSystem/textDocumentHelper";
import { FileInfoType, parseAppFile, YamlMapDescriptor } from "../../..";
import { getExpectedKeyRange, getMissingKeys } from "../../../_testingUtils";
import { TopLevelAppFileProperty } from "./constants/appFileConstants";

describe("parseAppFile", () => {
    it("parses valid file with all sections defined", () => {
        const documentText = `info:
  name: afgsdfgfdg
  type: app
  seq: 3
code: |
  gdsfgdfg
  dfg
`;

        const { result, errors } = parseAppFile(
            new TextDocumentHelper(documentText),
        );

        expect(errors).toHaveLength(0);
        const { info, code } = result!.properties;
        expect(info?.keyRange).toEqual(
            getExpectedKeyRange(0, TopLevelAppFileProperty.Info, 0),
        );
        expect(info?.properties.name?.value).toBe("afgsdfgfdg");
        expect(info?.properties.type?.value).toBe(FileInfoType.App);
        expect(info?.properties.sequence?.value).toBe(3);
        expect(code?.keyRange).toEqual(
            getExpectedKeyRange(4, TopLevelAppFileProperty.Code, 0),
        );
        expect(code?.value).toBe("gdsfgdfg\ndfg\n");
    });

    it("reports missing mandatory properties", () => {
        const mapDescriptors: YamlMapDescriptor[] = [];
        parseAppFile(new TextDocumentHelper(`foo: bar`), { mapDescriptors });

        const mandatory = getMissingKeys(mapDescriptors[0]).filter(
            ({ isMandatory }) => isMandatory,
        );
        expect(mandatory.map(({ key }) => key)).toEqual([
            TopLevelAppFileProperty.Info,
        ]);
    });

    it("does not require the code property", () => {
        const mapDescriptors: YamlMapDescriptor[] = [];
        const { result, errors } = parseAppFile(
            new TextDocumentHelper(`info:\n  name: test\n  type: app`),
            { mapDescriptors },
        );

        expect(errors).toHaveLength(0);
        expect(result!.properties.code).toBeUndefined();
        expect(
            getMissingKeys(mapDescriptors[0]).filter(
                ({ isMandatory }) => isMandatory,
            ),
        ).toHaveLength(0);
    });

    it("returns errors for invalid yaml syntax", () => {
        const { result, errors } = parseAppFile(
            new TextDocumentHelper(`info: [`),
        );

        expect(result).toBeUndefined();
        expect(errors.length).toBeGreaterThan(0);
    });
});
