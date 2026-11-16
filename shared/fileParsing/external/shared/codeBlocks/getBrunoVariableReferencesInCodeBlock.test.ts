import { describe, it, expect } from "@jest/globals";
import { Position, Range, TextDocumentHelper } from "../../../..";
import {
    BrunoVariableType,
    VariableAvailabilityScopes,
    VariableReferenceType,
} from "../../../..";
import { getBrunoVariableReferencesInCodeBlock } from "./getBrunoVariableReferencesInCodeBlock";

describe("getBrunoVariableReferencesInCodeBlock", () => {
    it.each([
        {
            functionName: "hasEnvVar",
            variableType: BrunoVariableType.Environment,
            referenceType: VariableReferenceType.Read,
            scope: VariableAvailabilityScopes.Collection,
        },
        {
            functionName: "hasVar",
            variableType: BrunoVariableType.Runtime,
            referenceType: VariableReferenceType.Read,
            scope: undefined,
        },
        {
            functionName: "hasGlobalEnvVar",
            variableType: BrunoVariableType.Global,
            referenceType: VariableReferenceType.Read,
            scope: VariableAvailabilityScopes.Global,
        },
        {
            functionName: "deleteGlobalEnvVar",
            variableType: BrunoVariableType.Global,
            referenceType: VariableReferenceType.Delete,
            scope: VariableAvailabilityScopes.Global,
        },
    ])(
        "recognizes 'bru.$functionName' as a $referenceType of a $variableType variable",
        ({ functionName, variableType, referenceType, scope }) => {
            const content = `bru.${functionName}("token");`;
            const references = getReferences(content);
            const start = content.indexOf("token");

            expect(references).toEqual([
                {
                    variableName: "token",
                    variableType,
                    referenceType,
                    scope,
                    variableNameRange: new Range(
                        new Position(0, start),
                        new Position(0, start + "token".length),
                    ),
                },
            ]);
        },
    );

    it.each(["hasEnvVar", "hasVar", "hasGlobalEnvVar", "deleteGlobalEnvVar"])(
        "does not recognize 'bru.%s' with a non-literal parameter",
        (functionName) => {
            expect(getReferences(`bru.${functionName}(name);`)).toEqual([]);
        },
    );

    it("recognizes 'bru.deleteVar' as deletion of a runtime variable", () => {
        const [reference] = getReferences('bru.deleteVar("token");');

        expect(reference).toEqual(
            expect.objectContaining({
                variableName: "token",
                referenceType: VariableReferenceType.Delete,
                variableType: BrunoVariableType.Runtime,
            }),
        );
        expect(reference.variableNameRange).toEqual(
            new Range(new Position(0, 15), new Position(0, 20)),
        );
    });

    it("distinguishes 'bru.deleteVar' from 'bru.deleteEnvVar'", () => {
        const references = getReferences(
            'bru.deleteVar("a");\nbru.deleteEnvVar("b");',
        );

        expect(
            references.map(({ variableName, variableType }) => ({
                variableName,
                variableType,
            })),
        ).toEqual([
            { variableName: "a", variableType: BrunoVariableType.Runtime },
            { variableName: "b", variableType: BrunoVariableType.Environment },
        ]);
    });

    it("does not recognize 'bru.deleteVar' with a non-literal parameter", () => {
        expect(getReferences("bru.deleteVar(name);")).toEqual([]);
    });
});

function getReferences(content: string) {
    const document = new TextDocumentHelper(content);
    const lines = content.split("\n");

    return getBrunoVariableReferencesInCodeBlock(
        document,
        new Range(
            new Position(0, 0),
            new Position(lines.length - 1, lines[lines.length - 1].length),
        ),
    );
}
