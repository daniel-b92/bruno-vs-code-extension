import { describe, it, expect } from "@jest/globals";
import * as ts from "typescript";
import {
    maskYamlCollectionFileContent,
    maskYamlFileContent,
} from "./maskYamlFileContent";

describe("maskYamlCollectionFileContent", () => {
    it("keeps only the code of scripts in request files and wraps each script in an arrow function", () => {
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
            ";$bU=async(".padEnd("    - type: before-request".length),
            "       res)=>{",
            "        const a = 1;",
            "}" + blank("   - type: tests"),
            ";async(  )=>{",
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
            ";async(   )=>{",
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
            ";$bU=async(".padEnd("    - type: before-request".length),
            "       res)=>{",
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
            ";async(   )=>{",
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

        expect(
            sourceFile.statements
                .filter(ts.isExpressionStatement)
                .map(({ expression }) =>
                    ts.isBinaryExpression(expression)
                        ? expression.right.kind
                        : expression.kind,
                ),
        ).toEqual([ts.SyntaxKind.ArrowFunction, ts.SyntaxKind.ArrowFunction]);
    });

    it("types the `bru` object and shadows `req` and `res` for gRPC requests", () => {
        const content = `info:
  name: request
  type: grpc
grpc:
  url: localhost:50051
  method: /example.Greeter/SayHello
runtime:
  scripts:
    - type: before-request
      code: |-
        const a = 1;
`;

        expect(maskYamlCollectionFileContent("request.yml", content)).toMatch(
            /;\$gP=async\([\s\S]*\bbru,req,res\)=>\{/,
        );
    });

    it("types the parameters depending on the type of the script", () => {
        const content = `info:
  name: request
runtime:
  scripts:
    - type: after-response
      code: |-
        const a = 1;
`;
        const maskedContent = maskYamlCollectionFileContent(
            "request.yml",
            content,
        );

        // `res` is not available before the request is sent, but `req` is available in all scripts.
        expect(maskedContent).not.toContain("$bU");
        expect(maskedContent).not.toMatch(/\b(req|res)\b/);
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
