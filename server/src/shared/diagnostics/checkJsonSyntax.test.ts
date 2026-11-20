import { Position, Range } from "@global_shared";
import { checkJsonSyntax } from "./checkJsonSyntax";

describe("checkJsonSyntax", () => {
    const content = '{\n  "asas": 33t\n}';
    const contentRange = new Range(new Position(5, 0), new Position(7, 1));

    it("should return nothing for valid JSON containing variables", () => {
        expect(
            checkJsonSyntax(
                { content: '{ "a": {{myVar}} }', contentRange },
                undefined,
            ),
        ).toBeUndefined();
    });

    it("should point to the precise position in the document without leaking content-relative positions", () => {
        const { diagnostic } = checkJsonSyntax(
            { content, contentRange },
            { firstContentLine: 6, indentation: 4 },
        )!;

        expect(diagnostic.message).toBe(
            "Invalid JSON: Expected ',' or '}' after property value",
        );
        expect(diagnostic.range.start).toEqual(new Position(7, 16));
    });

    it("should use the whole content range if no position mapping is given", () => {
        const { diagnostic } = checkJsonSyntax(
            { content, contentRange },
            undefined,
        )!;

        expect(diagnostic.message).not.toMatch(/position|line \d/);
        expect(diagnostic.range).toEqual(contentRange);
    });
});
