import { describe, it, expect } from "@jest/globals";
import { getDummyRange } from "@global_shared/_testingUtils";
import { getHoverContentForStaticEnvVariables } from "./getHoverContentForStaticEnvVariables";

describe("getHoverContentForStaticEnvVariables", () => {
    it("returns undefined when there are no matches", () => {
        expect(getHoverContentForStaticEnvVariables([])).toBeUndefined();
    });

    it("does not mention inheritance for a match from the configured environment itself", () => {
        const result = getHoverContentForStaticEnvVariables([
            {
                file: "/collection/environments/Dev.bru",
                matchingVariables: [getVariable("dev-value")],
                isConfiguredEnv: true,
            },
        ]);

        expect(result).toContain("| `dev-value` | `Dev` | &#x2611; |");
        expect(result).not.toContain("inherited");
    });

    it("mentions the environment inheriting the variable for an inherited match", () => {
        const result = getHoverContentForStaticEnvVariables([
            {
                file: "/collection/environments/Base.bru",
                matchingVariables: [getVariable("base-value")],
                isConfiguredEnv: false,
                inheritedByEnvironmentName: "Dev",
            },
        ]);

        expect(result).toContain(
            "| `base-value` | `Base (inherited by 'Dev')` | - |",
        );
    });

    it("does not mention inheritance for an unrelated environment", () => {
        const result = getHoverContentForStaticEnvVariables([
            {
                file: "/collection/environments/Other.bru",
                matchingVariables: [getVariable("other-value")],
                isConfiguredEnv: false,
            },
        ]);

        expect(result).toContain("| `other-value` | `Other` | - |");
        expect(result).not.toContain("inherited");
    });

    it("escapes a value containing a backtick so the code span isn't broken", () => {
        const result = getHoverContentForStaticEnvVariables([
            {
                file: "/collection/environments/Dev.bru",
                matchingVariables: [getVariable("has`backtick")],
                isConfiguredEnv: true,
            },
        ]);

        expect(result).toContain("| ``has`backtick`` | `Dev` | &#x2611; |");
    });
});

function getVariable(value: string) {
    const dummyRange = getDummyRange();
    return {
        key: "key",
        value,
        keyRange: dummyRange,
        valueRange: dummyRange,
    };
}
