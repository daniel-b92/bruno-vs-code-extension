import { describe, it, expect } from "@jest/globals";
import * as ts from "typescript";
import {
    maskYamlCollectionFileContent,
    maskYamlFileContent,
} from "./maskYamlFileContent";

describe("maskYamlCollectionFileContent", () => {
    it("keeps only the code of scripts in request files and wraps each script in a block", () => {
        const content = `info:
  name: test
runtime:
  scripts:
    - type: before-request
      code: |-
        const a = 1;
    - type: tests
      code: |
        test("x", () => {});
`;

        expect(
            maskYamlCollectionFileContent("request.yml", content).split("\n"),
        ).toEqual([
            blank("info:"),
            blank("  name: test"),
            blank("runtime:"),
            blank("  scripts:"),
            blank("    - type: before-request"),
            blank("      code: |") + "{",
            "        const a = 1;",
            "}" + blank("   - type: tests"),
            blank("      code: ") + "{",
            '        test("x", () => {});',
            "}",
        ]);
    });

    it("keeps the code of scripts in folder and collection settings files", () => {
        const content = `meta:
  name: folder
request:
  scripts:
    - type: after-response
      code: |-
        bru.setVar("a", res.status);`;

        expect(
            maskYamlCollectionFileContent("folder.yml", content).split("\n"),
        ).toEqual([
            blank("meta:"),
            blank("  name: folder"),
            blank("request:"),
            blank("  scripts:"),
            blank("    - type: after-response"),
            blank("      code: |") + "{",
            '        bru.setVar("a", res.status);',
            "}",
        ]);
    });

    it("keeps the code of scripts in collection settings files", () => {
        const content = `opencollection: 1.0.0
request:
  scripts:
    - type: before-request
      code: |-
        bru.setVar("a", 1);
`;

        expect(
            maskYamlCollectionFileContent("opencollection.yml", content).split(
                "\n",
            ),
        ).toEqual([
            blank("opencollection: 1.0.0"),
            blank("request:"),
            blank("  scripts:"),
            blank("    - type: before-request"),
            blank("      code: |") + "{",
            '        bru.setVar("a", 1);',
            "}",
        ]);
    });

    it("does not add the closing bracket of the last script to a line comment at the end of the file", () => {
        const content = `runtime:
  scripts:
    - type: tests
      code: |-
        test(); // comment`;

        const sourceFile = ts.createSourceFile(
            "test.ts",
            maskYamlCollectionFileContent("request.yml", content),
            ts.ScriptTarget.Latest,
        );

        expect(getSyntacticDiagnostics(sourceFile)).toEqual([]);
    });

    it("masks scripts with a missing or invalid type", () => {
        const content = `runtime:
  scripts:
    - code: |-
        const a = 1;
    - type: before-requset
      code: |-
        const b = 2;
`;

        expect(
            maskYamlCollectionFileContent("request.yml", content).trim(),
        ).toBe("");
    });

    it.each([
        { fileName: "request.yml", maskedSection: "request" },
        { fileName: "folder.yml", maskedSection: "runtime" },
    ])(
        "masks scripts in the '$maskedSection' section for $fileName",
        ({ fileName, maskedSection }) => {
            const content = `${maskedSection}:
  scripts:
    - type: tests
      code: |-
        test();
`;

            expect(
                maskYamlCollectionFileContent(fileName, content).trim(),
            ).toBe("");
        },
    );

    it("keeps line breaks of all kinds", () => {
        const content =
            "runtime:\r\n  scripts:\r\n    - type: tests\r\n      code: |-\r\n        test();\r\n";

        expect(
            maskYamlCollectionFileContent("request.yml", content).split("\r\n"),
        ).toEqual([
            blank("runtime:"),
            blank("  scripts:"),
            blank("    - type: tests"),
            blank("      code: |") + "{",
            "        test();",
            "}",
        ]);
    });

    it("masks scripts that are not defined as literal block scalars", () => {
        const content = `runtime:
  scripts:
    - type: before-request
      code: "bru.setVar('a', 1);"
    - type: tests
      code: >-
        test("x", () => {});
`;

        const maskedContent = maskYamlCollectionFileContent(
            "request.yml",
            content,
        );

        expect(maskedContent).toHaveLength(content.length);
        expect(maskedContent.trim()).toBe("");
    });

    it("scopes declarations to the script they are defined in", () => {
        const content = `runtime:
  scripts:
    - type: before-request
      code: |-
        const a = 1;
    - type: after-response
      code: |-
        const a = 2;
`;

        const sourceFile = ts.createSourceFile(
            "test.ts",
            maskYamlCollectionFileContent("request.yml", content),
            ts.ScriptTarget.Latest,
        );

        expect(sourceFile.statements.map(({ kind }) => kind)).toEqual([
            ts.SyntaxKind.Block,
            ts.SyntaxKind.Block,
        ]);
    });
});

describe("maskYamlFileContent", () => {
    it("replaces all characters except for line breaks by spaces", () => {
        expect(maskYamlFileContent("a: 1\r\nb:\n  - c\n")).toBe(
            `${blank("a: 1")}\r\n${blank("b:")}\n${blank("  - c")}\n`,
        );
    });
});

function getSyntacticDiagnostics(sourceFile: ts.SourceFile) {
    return (
        sourceFile as unknown as {
            parseDiagnostics: ts.DiagnosticWithLocation[];
        }
    ).parseDiagnostics;
}

function blank(text: string) {
    return " ".repeat(text.length);
}
