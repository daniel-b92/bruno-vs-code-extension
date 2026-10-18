import { BrunoFileType, ItemType } from "@global_shared";
import { TextDocument } from "vscode-languageserver-textdocument";
import { getHandlerForYamlFormatting } from "./getHandlerForYamlFormatting";

// Prettier can't be loaded in jest (it needs dynamic imports of ES modules), so it's replaced by simple stand-ins.
// The stand-in for scripts appends a semicolon to every line (that doesn't end with one yet) and uses the configured line break.
// The stand-in for Yaml collapses multiple spaces after a colon to one and fails for content containing `!invalid`.
// The stand-in for scripts fails for content containing `!broken`.
jest.mock("prettier", () => ({
    format: async (
        code: string,
        { parser, endOfLine }: { parser: string; endOfLine: string },
    ) => {
        const lineBreak = endOfLine == "crlf" ? "\r\n" : "\n";

        if (parser == "yaml") {
            if (code.includes("!invalid")) {
                throw new Error("Invalid Yaml");
            }
            return code.replace(/^(\s*(?:- )?[\w-]+:) {2,}(\S)/gm, "$1 $2");
        }

        if (code.includes("!broken")) {
            throw new Error("Invalid script");
        }

        return (
            code
                .split(/\r?\n/)
                .map((line) =>
                    line.trim() == "" || line.endsWith(";") ? line : `${line};`,
                )
                .join(lineBreak) + lineBreak
        );
    },
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

    it("should format all scripts of a file and keep blank lines between and after scripts", async () => {
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

    it("should keep whitespace-only lines within a script", async () => {
        // The second line of the template string consists of 3 spaces (after the indentation of the block scalar).
        expect(
            await format(
                "info:\n  name: test\n  type: http\nruntime:\n  scripts:\n    - type: tests\n      code: |\n        const s = `a\n           \n        b`\n",
            ),
        ).toBe(
            "info:\n  name: test\n  type: http\nruntime:\n  scripts:\n    - type: tests\n      code: |\n        const s = `a;\n           \n        b`;\n",
        );
    });

    it("should format the structure of the Yaml file and the scripts", async () => {
        expect(
            await format(`info:
  name:   test
  type: http
runtime:
  scripts:
    - type:   tests
      code: |
        test("x")
`),
        ).toBe(`info:
  name: test
  type: http
runtime:
  scripts:
    - type: tests
      code: |
        test("x");
`);
    });

    it("should return a single edit for the whole document", async () => {
        expect(
            await getEdits(`info:
  name:   test
  type: http
runtime:
  scripts:
    - type: tests
      code: |
        test("x")
`),
        ).toHaveLength(1);
    });

    it("should format the Yaml structure for files without scripts", async () => {
        expect(
            await format(
                `info:\n  name:   test\n  type: http\n`,
                BrunoFileType.RequestFile,
            ),
        ).toBe(`info:\n  name: test\n  type: http\n`);
    });

    it("should still format scripts if the Yaml cannot be parsed", async () => {
        expect(
            await format(`info:
  name:   !invalid
  type: http
runtime:
  scripts:
    - type: tests
      code: |
        test("x")
`),
        ).toBe(`info:
  name:   !invalid
  type: http
runtime:
  scripts:
    - type: tests
      code: |
        test("x");
`);
    });

    it("should still format the other scripts and the Yaml structure if a script cannot be parsed", async () => {
        expect(
            await format(`info:
  name:   test
  type: http
runtime:
  scripts:
    - type: before-request
      code: |
        !broken
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
        !broken
    - type: tests
      code: |
        test("x");
`);
    });

    it("should not format the Yaml structure if a block scalar has an explicit indentation indicator", async () => {
        expect(
            await getEdits(`info:
  name:   test
  type: http
runtime:
  scripts:
    - type: tests
      code: |2
          const a = 1
`),
        ).toHaveLength(0);
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
