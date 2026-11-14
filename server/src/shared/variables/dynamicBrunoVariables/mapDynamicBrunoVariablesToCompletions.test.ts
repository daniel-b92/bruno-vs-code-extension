import { describe, expect, it } from "@jest/globals";
import {
    BrunoVariableType,
    LineBreakType,
    Position,
    Range,
    VariableReferenceType,
} from "@global_shared";
import { VariableSpecificRequestData } from "../../interfaces";
import { getDynamicBrunoVariables } from "./dynamicBrunoVariables";
import { mapDynamicBrunoVariablesToCompletions } from "./mapDynamicBrunoVariablesToCompletions";

describe("mapDynamicBrunoVariablesToCompletions", () => {
    it("returns all dynamic variables with their description if the typed name starts with '$'", () => {
        const result = mapDynamicBrunoVariablesToCompletions(
            getRequestData("$ra"),
            getTextEdit,
        );

        expect(result).toHaveLength(getDynamicBrunoVariables().length);
        const randomInt = result.find(({ label }) => label == "$randomInt");
        expect(randomInt?.labelDetails?.description).toBe(
            "A random integer between 0 and 1000",
        );
        expect(randomInt?.documentation).toEqual({
            kind: "markdown",
            value: "A random integer between 0 and 1000. Example: `802, 494, 200`",
        });
    });

    it("replaces the typed name including the '$'", () => {
        const result = mapDynamicBrunoVariablesToCompletions(
            getRequestData("$ra"),
            getTextEdit,
        );

        expect(result[0].textEdit).toEqual({
            newText: "$guid",
            range: new Range(new Position(0, 2), new Position(0, 5)),
        });
    });

    it.each(["", "ra", "guid"])(
        "returns no completions if the typed name is '%s' (without '$')",
        (name) => {
            expect(
                mapDynamicBrunoVariablesToCompletions(
                    getRequestData(name),
                    getTextEdit,
                ),
            ).toEqual([]);
        },
    );

    it("contains only distinct names, which all start with '$'", () => {
        const names = getDynamicBrunoVariables().map(({ name }) => name);

        expect(new Set(names).size).toBe(names.length);
        expect(names.every((name) => name.startsWith("$"))).toBe(true);
    });
});

function getTextEdit(variableName: string, rangeToReplace: Range) {
    return { newText: variableName, range: rangeToReplace };
}

function getRequestData(name: string): VariableSpecificRequestData {
    return {
        variable: {
            name,
            start: new Position(0, 2),
            end: new Position(0, 5),
        },
        functionType: VariableReferenceType.Read,
        variableType: BrunoVariableType.Unknown,
        documentLineBreak: LineBreakType.Lf,
    };
}
