import { describe, expect, it } from "@jest/globals";
import {
    BrunoVariableType,
    Collection,
    CollectionDirectory,
    CollectionFormat,
    Position,
    Range,
    RequestFileBlockName,
    VariableAvailabilityScopes,
    VariableScopeSection,
    VariableScopeSectionKind,
} from "@global_shared";
import { createVariableReference } from "@global_shared/_testingUtils";
import { VariableSectionRequest } from "./interfaces";
import { getMatchingStaticScriptVariableReferences } from "./getMatchingStaticScriptVariableReferences";

describe("getMatchingStaticScriptVariableReferences", () => {
    it.each([
        [VariableScopeSectionKind.PreRequestScript],
        [VariableScopeSectionKind.PostResponseScript],
    ])(
        "returns matching pre-request variables from the current file and ancestor files for a %s section",
        (sectionKind) => {
            const rootDirectory = "/tmp/collection";
            const rootDirectoryItem = new CollectionDirectory(rootDirectory);
            const currentFilePath = `${rootDirectory}/requests/current.bru`;
            const defaultRange = new Range(
                new Position(0, 0),
                new Position(0, 20),
            );

            const collection = new Collection<any>(
                rootDirectoryItem,
                undefined,
                [],
                CollectionFormat.Bru,
            );

            collection.addItem({
                item: new CollectionDirectory(`${rootDirectory}/requests`),
                additionalData: [
                    {
                        reference: createVariableReference(),
                        sectionKind: VariableScopeSectionKind.PreRequestScript,
                        sectionName: RequestFileBlockName.PreRequestVars,
                    },
                ] as any,
            });

            const currentSection: VariableScopeSection = {
                kind: sectionKind,
                name: String(sectionKind),
                range: defaultRange,
                variableReferences: [],
            };

            const preRequestVarsSection: VariableScopeSection = {
                kind: VariableScopeSectionKind.PreRequestVars,
                name: RequestFileBlockName.PreRequestVars,
                range: defaultRange,
                variableReferences: [
                    createVariableReference(),
                    createVariableReference({
                        variableName: "ignoredVar",
                        scope: VariableAvailabilityScopes.Global,
                    }),
                ],
            };

            const request = {
                request: {
                    filePath: currentFilePath,
                    documentHelper: {} as any,
                    position: new Position(0, 0),
                    token: {} as any,
                },
                file: {
                    collection,
                    allSections: [currentSection, preRequestVarsSection],
                    sectionContainingPosition: currentSection,
                },
            } as unknown as VariableSectionRequest;

            const result = getMatchingStaticScriptVariableReferences(
                request,
                BrunoVariableType.Folder,
            );

            expect(result).toHaveLength(1);

            const [referenceGroup] = result;
            expect(referenceGroup.mostRelevantReference.path.absolute).toBe(
                currentFilePath,
            );
            expect(
                referenceGroup.mostRelevantReference.path.relativeToSourceFile,
            ).toBe(".");
            expect(
                referenceGroup.mostRelevantReference.reference.variableName,
            ).toBe("folderVar");
            expect(referenceGroup.mostRelevantReference.sectionName).toBe(
                RequestFileBlockName.PreRequestVars,
            );
            expect(referenceGroup.otherMatchingReferences).toHaveLength(1);
            expect(referenceGroup.otherMatchingReferences[0].sectionName).toBe(
                RequestFileBlockName.PreRequestVars,
            );
            expect(
                referenceGroup.otherMatchingReferences[0].path.absolute,
            ).toBe(`${rootDirectory}/requests`);
            expect(
                referenceGroup.otherMatchingReferences[0].indirectionLevel,
            ).toBe(1);
        },
    );
});
