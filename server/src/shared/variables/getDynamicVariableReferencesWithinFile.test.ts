import { describe, expect, it } from "@jest/globals";
import {
    BrunoVariableType,
    Position,
    TextDocumentHelper,
    VariableReferenceType,
    VariableScopeSection,
    VariableScopeSectionKind,
} from "@global_shared";
import {
    createVariableReference,
    getDummyRange,
} from "@global_shared/_testingUtils";
import { CancellationToken } from "vscode-languageserver";
import { getDynamicVariableReferencesWithinFile } from "./getDynamicVariableReferencesWithinFile";
import { VariableSectionRequest } from "./interfaces";

describe("getDynamicVariableReferencesWithinFile", () => {
    it("searches earlier sections for the writes that are relevant for a delete reference", () => {
        const preRequest = getSection(
            VariableScopeSectionKind.PreRequestScript,
            VariableReferenceType.Write,
        );
        const postResponse = getSection(
            VariableScopeSectionKind.PostResponseScript,
            VariableReferenceType.Delete,
        );

        const result = getDynamicVariableReferencesWithinFile(
            getRequest([preRequest, postResponse], postResponse),
            VariableReferenceType.Delete,
            BrunoVariableType.Runtime,
        );

        expect(result.map(({ blockName }) => blockName)).toEqual([
            preRequest.name,
        ]);
    });

    it("does not search later sections for a delete reference", () => {
        const preRequest = getSection(
            VariableScopeSectionKind.PreRequestScript,
            VariableReferenceType.Delete,
        );
        const postResponse = getSection(
            VariableScopeSectionKind.PostResponseScript,
            VariableReferenceType.Write,
        );

        const result = getDynamicVariableReferencesWithinFile(
            getRequest([preRequest, postResponse], preRequest),
            VariableReferenceType.Delete,
            BrunoVariableType.Runtime,
        );

        expect(result).toEqual([]);
    });

    it("searches later sections for the reads that are relevant for a write reference", () => {
        const preRequest = getSection(
            VariableScopeSectionKind.PreRequestScript,
            VariableReferenceType.Write,
        );
        const postResponse = getSection(
            VariableScopeSectionKind.PostResponseScript,
            VariableReferenceType.Read,
        );

        const result = getDynamicVariableReferencesWithinFile(
            getRequest([preRequest, postResponse], preRequest),
            VariableReferenceType.Write,
            BrunoVariableType.Runtime,
        );

        expect(result.map(({ blockName }) => blockName)).toEqual([
            postResponse.name,
        ]);
    });
});

function getSection(
    kind: VariableScopeSectionKind,
    referenceType: VariableReferenceType,
): VariableScopeSection {
    return {
        kind,
        name: String(kind),
        range: getDummyRange(),
        variableReferences: [
            createVariableReference({
                variableName: "token",
                variableType: BrunoVariableType.Runtime,
                referenceType,
                scope: undefined,
            }),
        ],
    };
}

function getRequest(
    allSections: VariableScopeSection[],
    sectionContainingPosition: VariableScopeSection,
): VariableSectionRequest {
    return {
        request: {
            filePath: "/collection/request.bru",
            documentHelper: new TextDocumentHelper(""),
            position: new Position(0, 0),
            token: CancellationToken.None,
        },
        file: {
            collection: undefined as never,
            allSections,
            sectionContainingPosition,
        },
    };
}
