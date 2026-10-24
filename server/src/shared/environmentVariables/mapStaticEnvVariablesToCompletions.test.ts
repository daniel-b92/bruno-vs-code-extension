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

    it("creates one completion per variable name if multiple environments define it", () => {
        const result = mapStaticEnvVariablesToCompletions(getRequestData(), [
            {
                environmentFile: "/collection/environments/Dev.bru",
                matchingVariableKeys: ["token", "url"],
                isConfiguredEnv: true,
            },
            {
                environmentFile: "/collection/environments/Prod.bru",
                matchingVariableKeys: ["token"],
                isConfiguredEnv: false,
            },
        ]);

        expect(result.map(({ label }) => label)).toEqual(["token", "url"]);
        expect(result[0].labelDetails?.description).toBe(
            "Env (2 environments)",
        );
        expect(result[0].sortText).toBe("_a_token");
        expect(result[1].labelDetails?.description).toBe("Env 'Dev'");
    });

    it("treats a key occurring multiple times in the same file as a single definition", () => {
        const result = mapStaticEnvVariablesToCompletions(getRequestData(), [
            {
                environmentFile: "/collection/environments/Dev.bru",
                matchingVariableKeys: ["token", "token"],
                isConfiguredEnv: true,
            },
        ]);

        expect(result).toHaveLength(1);
        expect(result[0].labelDetails?.description).toBe("Env 'Dev'");
    });

    it("sorts a variable below others if it is not defined in the configured environment", () => {
        const result = mapStaticEnvVariablesToCompletions(getRequestData(), [
            {
                environmentFile: "/collection/environments/Prod.bru",
                matchingVariableKeys: ["token"],
                isConfiguredEnv: false,
            },
        ]);

        expect(result[0].sortText).toBe("_b_token");
    });

    it("warns about overwriting for write functions", () => {
        const result = mapStaticEnvVariablesToCompletions(
            { ...getRequestData(), functionType: VariableReferenceType.Write },
            [
                {
                    environmentFile: "/collection/environments/Dev.bru",
                    matchingVariableKeys: ["token"],
                    isConfiguredEnv: true,
                },
            ],
        );

        expect(result[0].labelDetails?.description).toBe("!Env! 'Dev'");
        expect(result[0].detail).toContain("'Dev'");
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
