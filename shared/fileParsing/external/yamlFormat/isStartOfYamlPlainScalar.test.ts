import { describe, it, expect } from "@jest/globals";
import { Position, Range, TextDocumentHelper } from "../../..";
import { isStartOfYamlPlainScalar } from "./isStartOfYamlPlainScalar";

describe("isStartOfYamlPlainScalar", () => {
    it.each([
        ["url: {{dy", 0, 5, 9],
        ['"X-Api-Key": {{dy', 0, 14, 18],
        ["x.y: {{dy # comment", 0, 5, 9],
        ["- {{dy", 0, 2, 6],
        ["a:\n  - b\n  - {{dy", 2, 4, 8],
    ])("returns true for an unquoted value in '%s'", (text, line, start, end) => {
        expect(isStartOfYamlPlainScalar(...args(text, line, start, end))).toBe(
            true,
        );
    });

    it.each([
        ["data: |-\n  {{dy", 1, 2, 6],
        ["data: |-\n  - {{dy", 1, 4, 8],
        ['url: "abc {{dy', 0, 10, 14],
        ["url: abc{{dy", 0, 8, 12],
        ["url: abc\n  {{dy", 1, 2, 6],
    ])("returns false for '%s'", (text, line, start, end) => {
        expect(isStartOfYamlPlainScalar(...args(text, line, start, end))).toBe(
            false,
        );
    });
});

function args(
    text: string,
    line: number,
    start: number,
    end: number,
): [TextDocumentHelper, Range] {
    return [
        new TextDocumentHelper(text),
        new Range(new Position(line, start), new Position(line, end)),
    ];
}
