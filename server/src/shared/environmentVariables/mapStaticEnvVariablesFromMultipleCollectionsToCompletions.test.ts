import { describe, it, expect } from "@jest/globals";
import { VariableReferenceType } from "@global_shared";
import { getDummyRange } from "@global_shared/_testingUtils";
import { mapStaticEnvVariablesFromMultipleCollectionsToCompletions } from "./mapStaticEnvVariablesFromMultipleCollectionsToCompletions";

describe("mapStaticEnvVariablesFromMultipleCollectionsToCompletions", () => {
    it("creates a single item for a key defined in multiple collections", () => {
        const result = map(VariableReferenceType.Read, [
            getMatch({ collectionName: "colA", environment: "dev" }),
            getMatch({ collectionName: "colB", environment: "prod" }),
        ]);

        expect(result).toHaveLength(1);
        expect(result[0].labelDetails?.description).toBe(
            "Env (multiple collections)",
        );
    });

    it("creates a single item for a key defined in multiple environments of one collection", () => {
        const result = map(VariableReferenceType.Read, [
            getMatch({ collectionName: "colA", environment: "dev" }),
            getMatch({ collectionName: "colA", environment: "prod" }),
        ]);

        expect(result).toHaveLength(1);
        expect(result[0].labelDetails?.description).toBe(
            "Env collection 'colA'",
        );
    });

    it("names the environment for a key defined in exactly one environment", () => {
        const result = map(VariableReferenceType.Read, [
            getMatch({ collectionName: "colA", environment: "dev" }),
        ]);

        expect(result[0].labelDetails?.description).toBe("Env 'dev'");
    });

    it("uses the sort prefix 'a' if the key is in the configured environment of any collection", () => {
        const result = map(VariableReferenceType.Read, [
            getMatch({ collectionName: "colA", environment: "dev" }),
            getMatch({
                collectionName: "colB",
                environment: "prod",
                isConfiguredEnv: true,
            }),
            getMatch({
                collectionName: "colA",
                environment: "x",
                key: "other",
            }),
        ]);

        expect(result.map(({ sortText }) => sortText)).toEqual([
            "_a_token",
            "_b_other",
        ]);
    });

    it("shows the warning for write and delete functions", () => {
        const [single] = map(VariableReferenceType.Write, [
            getMatch({ collectionName: "colA", environment: "dev" }),
        ]);
        const [multiple] = map(VariableReferenceType.Delete, [
            getMatch({ collectionName: "colA", environment: "dev" }),
            getMatch({ collectionName: "colB", environment: "dev" }),
        ]);

        expect(single.labelDetails?.description).toBe("!Env! 'dev'");
        expect(single.detail).toContain("from env 'dev'");
        expect(multiple.labelDetails?.description).toBe(
            "!Env! (multiple collections)",
        );
        expect(multiple.detail).toBe(
            "WARNING: Will overwrite persistent environment variable(s)",
        );
    });

    it("lists the definitions of all collections in the documentation, including inherited ones", () => {
        const [item] = map(VariableReferenceType.Read, [
            getMatch({ collectionName: "colA", environment: "dev" }),
            getMatch({
                collectionName: "colB",
                environment: "local",
                inheritedByEnvironmentName: "dev",
                isConfiguredEnv: true,
            }),
        ]);

        const documentation = (item.documentation as { value: string }).value;
        expect(documentation).toContain("| value | collection |");
        expect(documentation).toContain("| `colA` | `dev` | - |");
        expect(documentation).toContain(
            "| `colB` | `local (inherited by 'dev')` | &#x2611; |",
        );
    });
});

function map(
    functionType: VariableReferenceType,
    matches: ReturnType<typeof getMatch>[],
) {
    return mapStaticEnvVariablesFromMultipleCollectionsToCompletions(
        functionType,
        matches,
    );
}

function getMatch({
    collectionName,
    environment,
    key = "token",
    isConfiguredEnv = false,
    inheritedByEnvironmentName,
}: {
    collectionName: string;
    environment: string;
    key?: string;
    isConfiguredEnv?: boolean;
    inheritedByEnvironmentName?: string;
}) {
    const dummyRange = getDummyRange();
    return {
        collectionName,
        file: `/${collectionName}/environments/${environment}.bru`,
        matchingVariables: [
            { key, value: "v", keyRange: dummyRange, valueRange: dummyRange },
        ],
        isConfiguredEnv,
        inheritedByEnvironmentName,
    };
}
