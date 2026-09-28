import { describe, it, expect } from "@jest/globals";
import { EnvironmentFileExtendsField } from "@global_shared";
import {
    createCollectionWithEnvironments,
    getDummyRange,
} from "@global_shared/_testingUtils";
import { checkExtendsFieldDoesNotCreateInheritanceLoop } from "./checkExtendsFieldDoesNotCreateInheritanceLoop";
import { RelevantWithinEnvironmentFileDiagnosticCode } from "../shared/diagnosticCodes/relevantWithinEnvironmentFileDiagnosticCodeEnum";

describe("checkExtendsFieldDoesNotCreateInheritanceLoop", () => {
    it("returns undefined when the extended environment does not extend anything", () => {
        const collection = createCollectionWithEnvironments([
            { name: "Base" },
            { name: "Dev" },
        ]);

        const result = checkExtendsFieldDoesNotCreateInheritanceLoop(
            "/collection/environments/Dev.bru",
            createExtendsField("Base"),
            collection,
        );

        expect(result).toBeUndefined();
    });

    it("returns undefined for a valid chain of more than one environment", () => {
        const collection = createCollectionWithEnvironments([
            { name: "Base" },
            { name: "Staging", extends: "Base" },
            { name: "Dev" },
        ]);

        const result = checkExtendsFieldDoesNotCreateInheritanceLoop(
            "/collection/environments/Dev.bru",
            createExtendsField("Staging"),
            collection,
        );

        expect(result).toBeUndefined();
    });

    it("returns a diagnostic when the extended environment directly extends this one", () => {
        const collection = createCollectionWithEnvironments([
            { name: "Base", extends: "Dev" },
            { name: "Dev" },
        ]);

        const result = checkExtendsFieldDoesNotCreateInheritanceLoop(
            "/collection/environments/Dev.bru",
            createExtendsField("Base"),
            collection,
        );

        expect(result?.code).toEqual(
            RelevantWithinEnvironmentFileDiagnosticCode.ExtendsFieldWouldCreateInheritanceLoop,
        );
    });

    it("returns a diagnostic when the extended environment indirectly extends this one", () => {
        const collection = createCollectionWithEnvironments([
            { name: "Base", extends: "Staging" },
            { name: "Staging", extends: "Dev" },
            { name: "Dev" },
        ]);

        const result = checkExtendsFieldDoesNotCreateInheritanceLoop(
            "/collection/environments/Dev.bru",
            createExtendsField("Base"),
            collection,
        );

        expect(result?.code).toEqual(
            RelevantWithinEnvironmentFileDiagnosticCode.ExtendsFieldWouldCreateInheritanceLoop,
        );
    });
});

function createExtendsField(value: string): EnvironmentFileExtendsField {
    const range = getDummyRange();

    return {
        value,
        keyRange: range,
        valueRange: range,
        fullRange: range,
    };
}
