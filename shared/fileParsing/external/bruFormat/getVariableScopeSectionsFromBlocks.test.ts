import { describe, expect, it } from "@jest/globals";
import {
    Block,
    Position,
    Range,
    RequestFileBlockName,
    VariableScopeSectionKind,
} from "../../..";
import { getVariableScopeSectionsFromBlocks } from "./getVariableScopeSectionsFromBlocks";

describe("getVariableScopeSectionsFromBlocks", () => {
    it.each([
        [
            RequestFileBlockName.PreRequestScript,
            VariableScopeSectionKind.PreRequestScript,
        ],
        [
            RequestFileBlockName.PostResponseScript,
            VariableScopeSectionKind.PostResponseScript,
        ],
        [RequestFileBlockName.Tests, VariableScopeSectionKind.Tests],
        [
            RequestFileBlockName.GrpcBeforeCallStartScript,
            VariableScopeSectionKind.GrpcBeforeCallStartScript,
        ],
        [
            RequestFileBlockName.GrpcBeforeMessageSendScript,
            VariableScopeSectionKind.GrpcBeforeMessageSendScript,
        ],
        [
            RequestFileBlockName.GrpcAfterMessageReceiveScript,
            VariableScopeSectionKind.GrpcAfterMessageReceiveScript,
        ],
        [
            RequestFileBlockName.GrpcAfterCallEndScript,
            VariableScopeSectionKind.GrpcAfterCallEndScript,
        ],
        [
            RequestFileBlockName.PreRequestVars,
            VariableScopeSectionKind.PreRequestVars,
        ],
        [
            RequestFileBlockName.PostResponseVars,
            VariableScopeSectionKind.PostResponseVars,
        ],
        [RequestFileBlockName.Assertions, VariableScopeSectionKind.Assertions],
        [RequestFileBlockName.Docs, VariableScopeSectionKind.NoVariableSupport],
        [RequestFileBlockName.Meta, VariableScopeSectionKind.NoVariableSupport],
        [
            RequestFileBlockName.Settings,
            VariableScopeSectionKind.NoVariableSupport,
        ],
        [RequestFileBlockName.Headers, VariableScopeSectionKind.Request],
    ])("maps block '%s' to the matching kind", (name, expectedKind) => {
        const [section] = getVariableScopeSectionsFromBlocks([
            createBlock(name),
        ]);

        expect(section.kind).toBe(expectedKind);
        expect(section.name).toBe(name);
    });

    it("takes over the content range and the variable references", () => {
        const contentRange = new Range(new Position(1, 0), new Position(2, 5));
        const variableReferences = [
            {
                variableName: "a",
                variableNameRange: contentRange,
            },
        ] as Block["variableReferences"];

        const [section] = getVariableScopeSectionsFromBlocks([
            {
                ...createBlock(RequestFileBlockName.Headers),
                contentRange,
                variableReferences,
            },
            createBlock(RequestFileBlockName.Meta),
        ]);

        expect(section.range).toBe(contentRange);
        expect(section.variableReferences).toBe(variableReferences);
    });

    it("uses an empty list for blocks without variable references", () => {
        const [section] = getVariableScopeSectionsFromBlocks([
            createBlock(RequestFileBlockName.Docs),
        ]);

        expect(section.variableReferences).toEqual([]);
    });
});

function createBlock(name: string): Block {
    const range = new Range(new Position(0, 0), new Position(0, 0));
    return { name, nameRange: range, content: "", contentRange: range };
}
