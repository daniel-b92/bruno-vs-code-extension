import { BrunoFileType, ItemType } from "@global_shared";
import { TextDocument } from "vscode-languageserver-textdocument";
import { getHandlerForYamlFormatting } from "./getHandlerForYamlFormatting";

// Prettier can't be loaded in jest (it needs dynamic imports of ES modules), so it's replaced by a simple stand-in.
// The stand-in appends a semicolon to every line (that doesn't end with one yet) and uses the configured line break.
jest.mock("prettier", () => ({
    format: async (code: string, { endOfLine }: { endOfLine: string }) =>
        code
            .split(/\r?\n/)
            .map((line) =>
                line.trim() == "" || line.endsWith(";") ? line : `${line};`,
            )
            .join(endOfLine == "crlf" ? "\r\n" : "\n") +
        (endOfLine == "crlf" ? "\r\n" : "\n"),
}));

describe("getHandlerForYamlFormatting", () => {
    it("should format scripts and keep the indentation of the block scalar", async () => {
        expect(
            await format(`info:
  name: test
  type: http
runtime:
  scripts:
    - type: before-request
      code: |-
        const a = 1
        if (a) {
          foo(a)
        }
`),
        ).toBe(`info:
  name: test
  type: http
runtime:
  scripts:
    - type: before-request
      code: |-
        const a = 1;
        if (a) {;
          foo(a);
        };
`);
    });

    it("should format all scripts of a file and keep blank lines", async () => {
        expect(
            await format(`info:
  name: test
  type: http
runtime:
  scripts:
    - type: before-request
      code: |
        bru.setVar("a", 1)


        bru.setVar("b", 2)

    - type: tests
      code: |
        test("x")
`),
        ).toBe(`info:
  name: test
  type: http
runtime:
  scripts:
    - type: before-request
      code: |
        bru.setVar("a", 1);


        bru.setVar("b", 2);

    - type: tests
      code: |
        test("x");
`);
    });

    it("should keep the relative indentation of lines within a script", async () => {
        expect(
            await format(`info:
  name: test
  type: http
runtime:
  scripts:
    - type: tests
      code: |
        first
            second
`),
        ).toBe(`info:
  name: test
  type: http
runtime:
  scripts:
    - type: tests
      code: |
        first;
            second;
`);
    });

    it("should keep scripts that are already formatted", async () => {
        expect(
            await getEdits(`info:
  name: test
  type: http
runtime:
  scripts:
    - type: tests
      code: |
        test("x");
`),
        ).toHaveLength(0);
    });

    it("should not touch scripts with an explicit indentation indicator", async () => {
        expect(
            await getEdits(`info:
  name: test
  type: http
runtime:
  scripts:
    - type: tests
      code: |2
          const a = 1
`),
        ).toHaveLength(0);
    });

    it("should not touch scripts that are no literal block scalars", async () => {
        expect(
            await getEdits(`info:
  name: test
  type: http
runtime:
  scripts:
    - type: tests
      code: "const a = 1"
`),
        ).toHaveLength(0);
    });

    it("should use the line break of the document", async () => {
        expect(
            await format(
                "info:\r\n  name: test\r\n  type: http\r\nruntime:\r\n  scripts:\r\n    - type: tests\r\n      code: |\r\n        const a = 1\r\n        const b = 2\r\n",
            ),
        ).toBe(
            "info:\r\n  name: test\r\n  type: http\r\nruntime:\r\n  scripts:\r\n    - type: tests\r\n      code: |\r\n        const a = 1;\r\n        const b = 2;\r\n",
        );
    });

    it("should not return edits for files without scripts", async () => {
        expect(
            await getEdits(
                `info:\n  name: test\n  type: http\n`,
                BrunoFileType.RequestFile,
            ),
        ).toHaveLength(0);
    });

    it("should format scripts in folder settings files", async () => {
        expect(
            await format(
                `info:
  name: folder
  type: folder
request:
  scripts:
    - type: after-response
      code: |
        console.log(res.status)
`,
                BrunoFileType.FolderSettingsFile,
            ),
        ).toBe(`info:
  name: folder
  type: folder
request:
  scripts:
    - type: after-response
      code: |
        console.log(res.status);
`);
    });
});

async function getEdits(
    content: string,
    itemType: ItemType = BrunoFileType.RequestFile,
) {
    return getHandlerForYamlFormatting(createDocument(content), itemType);
}

async function format(
    content: string,
    itemType: ItemType = BrunoFileType.RequestFile,
) {
    return TextDocument.applyEdits(
        createDocument(content),
        await getEdits(content, itemType),
    );
}

function createDocument(content: string) {
    return TextDocument.create("file:///test.yml", "yaml", 1, content);
}
