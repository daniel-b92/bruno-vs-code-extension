import { describe, it, expect } from "@jest/globals";
import { Position, Range, TextDocumentHelper } from "../../../..";
import { BrunoVariableType, VariableReferenceType } from "../../../..";
import { getBrunoVariableReferencesInCodeBlock } from "./getBrunoVariableReferencesInCodeBlock";

describe("getBrunoVariableReferencesInCodeBlock", () => {
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
