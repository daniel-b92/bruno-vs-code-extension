import { describe, it, expect } from "@jest/globals";
import {
    BrunoVariableType,
    LineBreakType,
    Position,
    VariableReferenceType,
} from "@global_shared";
import { VariableSpecificRequestData } from "../interfaces";
import { mapStaticEnvVariablesToCompletions } from "./mapStaticEnvVariablesToCompletions";

describe("mapStaticEnvVariablesToCompletions", () => {
    it("does not mention inheritance for a variable from the configured environment itself", () => {
        const result = mapStaticEnvVariablesToCompletions(getRequestData(), [
            {
                environmentFile: "/collection/environments/Dev.bru",
                matchingVariableKeys: ["token"],
                isConfiguredEnv: true,
            },
        ]);

        expect(result[0].labelDetails?.description).toBe("Env 'Dev'");
    });

    it("mentions the inheriting environment for a variable only available via inheritance", () => {
        const result = mapStaticEnvVariablesToCompletions(getRequestData(), [
            {
                environmentFile: "/collection/environments/Base.bru",
                matchingVariableKeys: ["token"],
                isConfiguredEnv: false,
                inheritedByEnvironmentName: "Dev",
            },
        ]);

        expect(result[0].labelDetails?.description).toBe(
            "Env 'Base' (inherited by 'Dev')",
        );
    });

    it("does not mention inheritance for a variable from an unrelated environment", () => {
        const result = mapStaticEnvVariablesToCompletions(getRequestData(), [
            {
                environmentFile: "/collection/environments/Other.bru",
                matchingVariableKeys: ["token"],
                isConfiguredEnv: false,
            },
        ]);

        expect(result[0].labelDetails?.description).toBe("Env 'Other'");
    });
});

function getRequestData(): VariableSpecificRequestData {
    return {
        variable: {
            name: "token",
            start: new Position(0, 0),
            end: new Position(0, 0),
        },
        functionType: VariableReferenceType.Read,
        variableType: BrunoVariableType.Environment,
        documentLineBreak: LineBreakType.Lf,
    };
}
