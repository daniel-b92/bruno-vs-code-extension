import { describe, it, expect } from "@jest/globals";
import {
    getInbuiltFunctionAndFirstParameterIfStringLiteral,
    getInbuiltFunctionIdentifiers,
    InbuiltFunctionName,
    Position,
} from "../../../..";

describe("getInbuiltFunctionAndFirstParameterIfStringLiteral", () => {
    it("finds a string parameter and its range", () => {
        const result = parse('bru.getVar("token");', "token");

        expect(result?.inbuiltFunction.identifier.functionName).toBe(
            InbuiltFunctionName.GetVar,
        );
        expect(result?.firstParameter).toEqual({
            name: "token",
            start: new Position(0, 12),
            end: new Position(0, 17),
            nodeContainsPosition: true,
        });
    });

    it.each([
        ["single quotes", "bru.getVar('token')"],
        ["a template literal without substitutions", "bru.getVar(`token`)"],
        ["optional chaining", 'bru?.getVar("token")'],
        ["whitespace and comments", 'bru /* c */ . getVar (\n "token")'],
    ])("handles %s", (_, content) => {
        expect(parse(content, "token")?.firstParameter.name).toBe("token");
    });

    it.each([
        ["a variable", "bru.getVar(token)"],
        ["a template literal with substitutions", "bru.getVar(`to${ken}`)"],
        ["no parameter", "bru.getVar()"],
    ])("does not find a parameter that is %s", (_, content) => {
        expect(parse(content, content.indexOf("getVar") + 1)).toBeUndefined();
    });

    it("ignores calls within comments and strings", () => {
        const content =
            '// bru.getVar("first")\nconst s = "bru.getVar(\\"second\\")"; /* bru.getVar("third") */';

        for (const name of ["first", "second", "third"]) {
            expect(parse(content, name)).toBeUndefined();
        }
    });

    it("ignores functions that are properties of other objects", () => {
        expect(parse('foo.bru.getVar("name")', "name")).toBeUndefined();
    });

    it("uses the innermost call at the position", () => {
        const content = 'bru.setVar("outer", bru.getVar("inner"));';

        expect(parse(content, "outer")?.inbuiltFunction.identifier).toEqual(
            expect.objectContaining({
                functionName: InbuiltFunctionName.SetVar,
            }),
        );
        expect(parse(content, "inner")?.inbuiltFunction.identifier).toEqual(
            expect.objectContaining({
                functionName: InbuiltFunctionName.GetVar,
            }),
        );
    });

    it("only treats the position as part of the parameter within the string", () => {
        const content = 'bru.getVar("token");';

        expect(parse(content, 12)?.firstParameter.nodeContainsPosition).toBe(
            true,
        );
        expect(parse(content, 11)?.firstParameter.nodeContainsPosition).toBe(
            false,
        );
        expect(parse(content, 18)?.firstParameter.nodeContainsPosition).toBe(
            false,
        );
    });

    it("works with code that is still being edited", () => {
        expect(parse('bru.getVar("token"', "token")?.firstParameter.name).toBe(
            "token",
        );
        expect(
            parse(
                'bru.getVar("first"\nconst x = 1;\nbru.getVar("second")',
                "second",
            )?.firstParameter.name,
        ).toBe("second");
        expect(
            parse('const s = "unfinished\nbru.getVar("second")', "second")
                ?.firstParameter.name,
        ).toBe("second");
    });

    it("takes the start position of the content into account", () => {
        const result = getInbuiltFunctionAndFirstParameterIfStringLiteral({
            functionsToSearchFor: getInbuiltFunctionIdentifiers(),
            position: new Position(5, 14),
            relevantContent: {
                asString: 'bru.getVar("token");',
                startPosition: new Position(5, 0),
            },
        });

        expect(result?.firstParameter.start).toEqual(new Position(5, 12));
        expect(result?.firstParameter.end).toEqual(new Position(5, 17));
    });
});

/** The position is either an offset in the content or text within the content that the position is placed in. */
function parse(content: string, positionOrTextInContent: number | string) {
    const offset =
        typeof positionOrTextInContent == "number"
            ? positionOrTextInContent
            : content.indexOf(positionOrTextInContent) + 1;
    const textBeforePosition = content.substring(0, offset).split("\n");

    return getInbuiltFunctionAndFirstParameterIfStringLiteral({
        functionsToSearchFor: getInbuiltFunctionIdentifiers(),
        position: new Position(
            textBeforePosition.length - 1,
            textBeforePosition[textBeforePosition.length - 1].length,
        ),
        relevantContent: {
            asString: content,
            startPosition: new Position(0, 0),
        },
    });
}
