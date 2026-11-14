import { describe, expect, it } from "@jest/globals";
import {
    BrunoFileType,
    BrunoVariableType,
    CollectionFormat,
    VariableAvailabilityScopes,
    VariableReferenceType,
    VariableScopeSectionKind,
} from "../../..";
import { getVariableScopeSectionsFromFile } from "./getVariableScopeSectionsFromFile";

describe("getVariableScopeSectionsFromFile", () => {
    describe("Bru format", () => {
        const requestContent = `vars:pre-request {
  userId: 42
}

vars:post-response {
  token: res.body.token
}
`;

        it("treats pre-request vars of a request file as request variables that are available to scripts", () => {
            const sections = getSections(
                requestContent,
                BrunoFileType.RequestFile,
            );

            expect(
                sections.find(
                    ({ kind }) =>
                        kind == VariableScopeSectionKind.PreRequestVars,
                )?.variableReferences,
            ).toEqual([
                expect.objectContaining({
                    variableName: "userId",
                    referenceType: VariableReferenceType.Write,
                    variableType: BrunoVariableType.Request,
                    scope: VariableAvailabilityScopes.PreRequestScriptForOwnItemAndDescendants,
                }),
            ]);
        });

        it.each([
            BrunoFileType.RequestFile,
            BrunoFileType.FolderSettingsFile,
            BrunoFileType.CollectionSettingsFile,
        ])(
            "treats post-response vars of a %s as runtime variables",
            (itemType) => {
                const sections = getSections(requestContent, itemType);

                const references = sections.find(
                    ({ kind }) =>
                        kind == VariableScopeSectionKind.PostResponseVars,
                )?.variableReferences;

                expect(references).toEqual([
                    expect.objectContaining({
                        variableName: "token",
                        referenceType: VariableReferenceType.Write,
                        variableType: BrunoVariableType.Runtime,
                    }),
                ]);
                expect(references?.[0].scope).toBeUndefined();
            },
        );
    });
});

function getSections(content: string, itemType: BrunoFileType) {
    return getVariableScopeSectionsFromFile(
        content,
        itemType,
        CollectionFormat.Bru,
    );
}
