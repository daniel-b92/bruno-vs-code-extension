import { describe, expect, it } from "@jest/globals";
import {
    BrunoVariableType,
    CodeBlock,
    Collection,
    CollectionDirectory,
    DictionaryBlock,
    Position,
    Range,
    RequestFileBlockName,
    VariableAvailabilityScopes,
    VariableReferenceType,
} from "@global_shared";
import { BlockRequestWithAdditionalData } from "../interfaces";
import { getMatchingStaticScriptVariableReferences } from "./getMatchingStaticScriptVariableReferences";

describe("getMatchingStaticScriptVariableReferences", () => {
    it("returns matching script variable references from the current file and ancestor files", () => {
        const rootDirectory = "/tmp/collection";
        const rootDirectoryItem = new CollectionDirectory(rootDirectory);
        const currentFilePath = `${rootDirectory}/requests/current.bru`;
        const defaultRange = new Range(new Position(0, 0), new Position(0, 20));

        const collection = new Collection<any>(
            rootDirectoryItem,
            undefined,
            [],
        );

        collection.addItem({
            item: new CollectionDirectory(`${rootDirectory}/requests`),
            additionalData: [
                {
                    reference: createReference(),
                    block: RequestFileBlockName.PreRequestScript,
                },
            ] as any,
        });

        const currentBlock = {
            name: RequestFileBlockName.PreRequestScript,
            nameRange: defaultRange,
            content: "",
            contentRange: defaultRange,
        } as CodeBlock;

        const preRequestVarsBlock = {
            name: RequestFileBlockName.PreRequestVars,
            nameRange: defaultRange,
            content: [
                {
                    key: "any",
                    keyRange: defaultRange,
                    disabled: false,
                    value: "bla",
                    valueRange: defaultRange,
                },
            ],
            contentRange: defaultRange,
            variableReferences: [
                createReference(),
                createReference({
                    variableName: "ignoredVar",
                    scope: VariableAvailabilityScopes.Global,
                }),
            ],
        } as DictionaryBlock;

        const request = {
            request: {
                filePath: currentFilePath,
                documentHelper: {} as any,
                position: new Position(0, 0),
                token: {} as any,
            },
            file: {
                collection,
                allBlocks: [currentBlock, preRequestVarsBlock],
                blockContainingPosition: currentBlock,
            },
        } as unknown as BlockRequestWithAdditionalData<CodeBlock>;

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
        expect(referenceGroup.otherMatchingReferences).toHaveLength(1);
        expect(referenceGroup.otherMatchingReferences[0].path.absolute).toBe(
            `${rootDirectory}/requests`,
        );
        expect(referenceGroup.otherMatchingReferences[0].indirectionLevel).toBe(
            1,
        );
    });
});

function createReference(
    overrides: Partial<
        NonNullable<CodeBlock["variableReferences"]>[number]
    > = {},
) {
    return {
        variableName: "folderVar",
        variableNameRange: new Range(new Position(0, 0), new Position(0, 9)),
        variableType: BrunoVariableType.Folder,
        referenceType: VariableReferenceType.Write,
        scope: VariableAvailabilityScopes.PreRequestScriptForOwnItemAndDescendants,
        ...overrides,
    };
}
