import { TextDocumentHelper } from "@global_shared";
import { DiagnosticSeverity } from "vscode-languageserver";
import { checkFileStartsWithExpectedSection } from "./checkFileStartsWithExpectedSection";

describe("checkFileStartsWithExpectedSection", () => {
    it.each([
        ["info", "info:\n  name: a\ncode: foo\n"],
        ["opencollection", "opencollection: 1.0.0\ninfo:\n  name: a\n"],
        ["no expected section at all", "name: a\ncode: foo\n"],
        ["an indented key", "foo:\n  info: a\n"],
        ["a key that only starts with 'info'", "information: a\n"],
    ])("returns nothing if the file starts with %s", (_, content) => {
        expect(check(content)).toBeUndefined();
    });

    it.each([
        ["a comment", "# comment\ninfo:\n  name: a\n", 1],
        ["a blank line", "\ninfo:\n  name: a\n", 1],
        ["another key", "name: a\ninfo:\n  name: a\n", 1],
        ["a document marker", "---\ninfo: {}\n", 1],
    ])(
        "reports the 'info' section if the file starts with %s",
        (_, content, line) => {
            expect(check(content)).toMatchObject({
                severity: DiagnosticSeverity.Information,
                range: {
                    start: { line, character: 0 },
                    end: { line, character: 4 },
                },
            });
        },
    );

    it("reports the 'opencollection' key if it is not in the first line", () => {
        expect(check("# comment\nopencollection: 1.0.0\n")?.range).toEqual({
            start: { line: 1, character: 0 },
            end: { line: 1, character: 14 },
        });
    });
});

function check(content: string) {
    const docHelper = new TextDocumentHelper(content);

    return checkFileStartsWithExpectedSection({
        filePath: "/collection/file.yml",
        docHelper,
        fullDocumentRange: docHelper.getTextRange(),
    });
}
