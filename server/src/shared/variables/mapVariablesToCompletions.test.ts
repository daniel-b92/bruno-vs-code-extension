import { describe, expect, it } from "@jest/globals";
import {
    BrunoVariableType,
    LineBreakType,
    Position,
    VariableReferenceType,
} from "@global_shared";
import { createVariableReference } from "@global_shared/_testingUtils";
import { VariableSpecificRequestData } from "../interfaces";
import { mapVariablesToCompletions } from "./mapVariablesToCompletions";
import { MatchingDynamicVariables } from "./interfaces";

describe("mapVariablesToCompletions", () => {
    it.each([
        VariableReferenceType.Read,
        VariableReferenceType.Write,
        VariableReferenceType.Delete,
    ])(
        "returns only one completion for a variable that is set in a script and defined in an environment file (function type %s)",
        (functionType) => {
            const result = mapVariablesToCompletions(
                getMatches(),
                getRequestData(functionType),
            );

            expect(result).toHaveLength(1);
            expect(result[0].label).toBe("token");
            expect(result[0].labelDetails?.description).toContain(
                "Section 'script:pre-request'",
            );
        },
    );

    it("returns the environment variable if no script references it", () => {
        const result = mapVariablesToCompletions(
            {
                ...getMatches(),
                dynamicVariables: { fromSameFile: [], fromOtherFiles: [] },
            },
            getRequestData(VariableReferenceType.Delete),
        );

        expect(result).toHaveLength(1);
        expect(result[0].labelDetails?.description).toBe("⚠ Delete Env 'Dev'");
    });
});

function getMatches() {
    const dynamicVariables: MatchingDynamicVariables = {
        fromSameFile: [
            {
                blockName: "script:pre-request",
                variableReference: createVariableReference({
                    variableName: "token",
                    variableType: BrunoVariableType.Environment,
                    scope: undefined,
                }),
            },
        ],
        fromOtherFiles: [],
    };

    return {
        staticEnvVariables: [
            {
                environmentFile: "/collection/environments/Dev.bru",
                matchingVariableKeys: ["token"],
                isConfiguredEnv: true,
            },
        ],
        dynamicVariables,
    };
}

function getRequestData(
    functionType: VariableReferenceType,
): VariableSpecificRequestData {
    return {
        variable: {
            name: "token",
            start: new Position(0, 0),
            end: new Position(0, 0),
        },
        functionType,
        variableType: BrunoVariableType.Environment,
        documentLineBreak: LineBreakType.Lf,
    };
}
