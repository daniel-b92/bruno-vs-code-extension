import { describe, it, expect } from "@jest/globals";
import { BrunoFileType, TextDocumentHelper } from "../../..";
import { getScriptBlocksFromYamlFile } from "./getScriptBlocksFromYamlFile";
import { FileInfoType, ScriptType } from "./constants/sharedConstants";

describe("getScriptBlocksFromYamlFile", () => {
    it("returns raw lines (with indentation) of literal block scalars in request files", () => {
        const { blocks, requestType } = getBlocks(
            `info:
  name: test
  type: http
runtime:
  scripts:
    - type: before-request
      code: |-
        bru.setVar("a", 1);

        bru.setVar("b", 2);
    - type: tests
      code: |
        test("x", () => {});
`,
            BrunoFileType.RequestFile,
        );

        expect(requestType).toBe(FileInfoType.Http);
        expect(blocks).toHaveLength(2);
        expect(blocks[0]).toMatchObject({
            name: "scripts[0]:before-request",
            scriptType: ScriptType.BeforeRequest,
            content: `        bru.setVar("a", 1);\n\n        bru.setVar("b", 2);`,
        });
        expect(blocks[0].contentRange.start.line).toBe(7);
        expect(blocks[0].contentRange.end.line).toBe(9);
        expect(blocks[1].name).toBe("scripts[1]:tests");
        expect(blocks[1].content).toBe(`        test("x", () => {});`);
    });

    it("skips scripts that are not literal block scalars", () => {
        const { blocks } = getBlocks(
            `info:
  name: test
  type: http
runtime:
  scripts:
    - type: before-request
      code: "bru.setVar('a', 1);"
    - type: after-response
      code: bru.setVar('a', 1);
`,
            BrunoFileType.RequestFile,
        );

        expect(blocks).toHaveLength(0);
    });

    it("reads scripts from `request.scripts` for folder settings files", () => {
        const { blocks } = getBlocks(
            `info:
  name: folder
  type: folder
request:
  scripts:
    - type: after-response
      code: |-
        console.log(res.status);
`,
            BrunoFileType.FolderSettingsFile,
        );

        expect(blocks.map(({ name }) => name)).toEqual([
            "scripts[0]:after-response",
        ]);
    });

    it("returns no blocks for other file types", () => {
        const { blocks } = getBlocks(
            `info:
  type: app
`,
            BrunoFileType.AppFile,
        );

        expect(blocks).toHaveLength(0);
    });
});

function getBlocks(content: string, itemType: BrunoFileType) {
    return getScriptBlocksFromYamlFile(
        new TextDocumentHelper(content),
        itemType,
    );
}
